const RPC_URL = 'https://node.xian.org';

export function truncateAddressMid(address) {
    if (!address || typeof address !== 'string') return '';
    if (address.length <= 10) return address;
    return `${address.slice(0, 4)}....${address.slice(-3)}`;
}

const TX_STORAGE_PREFIX = 'XiLotto_finish_tx_';

export function storeFinishTxId(drawId, txid) {
    try {
        if (typeof window === 'undefined') return;
        localStorage.setItem(`${TX_STORAGE_PREFIX}${drawId}`, txid);
    } catch {}
}

export function getFinishTxId(drawId) {
    try {
        if (typeof window === 'undefined') return null;
        return localStorage.getItem(`${TX_STORAGE_PREFIX}${drawId}`);
    } catch {
        return null;
    }
}

export function getTxUrl(txid) {
    if (!txid) return '#';
    return `https://explorer.xian.org/tx/${txid}`;
}

async function sha256Hex(bytes) {
    const digest = await crypto.subtle.digest('SHA-256', bytes);
    const arr = Array.from(new Uint8Array(digest));
    return arr.map(b => b.toString(16).padStart(2, '0')).join('');
}

function base64ToBytes(b64) {
    const bin = atob(b64);
    const len = bin.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) bytes[i] = bin.charCodeAt(i);
    return bytes;
}
// Requires you already have: base64ToBytes(b64) -> Uint8Array, sha256Hex(bytes) -> lowercase hex
// Also assumes you have: storeFinishTxId(drawId, hashHex)

async function abciQueryFlexible(rpc, keyPath) {
  const enc = encodeURIComponent;

  // 1) GET with quoted path
  let url = `${rpc}/abci_query?path=${enc(`"${keyPath}"`)}&prove=false`;
  let r = await fetch(url);
  if (r.ok) {
    const j = await r.json();
    if (!j.error && j?.result?.response) return j;
  }

  // 2) GET with quoted data (some ABCI apps expect `data` instead of `path`)
  url = `${rpc}/abci_query?data=${enc(`"${keyPath}"`)}&prove=false`;
  r = await fetch(url);
  if (r.ok) {
    const j = await r.json();
    if (!j.error && j?.result?.response) return j;
  }

  // 3) JSON-RPC POST (named params)
  r = await fetch(rpc, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "abci_query",
      params: { path: keyPath, prove: false },
    }),
  });
  if (r.ok) {
    const j = await r.json();
    if (!j.error && j?.result?.response) return j;
  }

  // 4) JSON-RPC POST (positional params: [path, data, height, prove])
  r = await fetch(rpc, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 2,
      method: "abci_query",
      params: [keyPath, null, null, false],
    }),
  });
  if (r.ok) {
    const j = await r.json();
    if (!j.error && j?.result?.response) return j;
  }

  throw new Error("ABCI query failed in all modes");
}

// Helper to query Xian’s GraphQL API for events
async function findDrawFinishedEventTx(drawId, contract, graphqlUrl) {
  const query = `
    query($contract: String!, $drawId: JSON!) {
      allEvents(
        first: 1,
        filter: {
          contract: { equalTo: $contract },
          event: { equalTo: "DrawFinished" },
          dataIndexed: { contains: { draw_id: $drawId } }
        }
      ) {
        nodes { txHash }
      }
    }
  `;
  const body = JSON.stringify({
    query,
    variables: { contract, drawId: String(drawId) },
  });
  const r = await fetch(graphqlUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body,
  });
  const j = await r.json();
  return j?.data?.allEvents?.nodes?.[0]?.txHash || null;
}

export async function findAndStoreTxForDraw(
  drawId,
  contract = "con_xilottov1",
  {
    // mainnet GraphQL endpoint; override for testnet/devnet if needed
    graphqlUrl = "https://node.xian.org/graphql",
    rpcUrl = "https://node.xian.org",
  } = {}
) {
  // 1) Try GraphQL first – this returns the exact transaction hash if it exists
  try {
    const txHash = await findDrawFinishedEventTx(drawId, contract, graphqlUrl);
    if (txHash) {
      // store and return the hash (no 0x prefix – Tendermint expects plain hex)
      storeFinishTxId(drawId, txHash);
      return txHash;
    }
  } catch (e) {
    // ignore and fall through to the legacy scanner
  }

  // 2) Legacy fallback: look up the draw_winner key and scan the block(s)
  try {
    // query the last-write height for the winner key (quoted path)
    const keyPath = `/get/${contract}.draw_winner:${drawId}`;
    const encPath = encodeURIComponent(`"${keyPath}"`);
    const r = await fetch(`${rpcUrl}/abci_query?path=${encPath}&prove=false`);
    const j = await r.json();
    const resp = j?.result?.response;
    const b64 = resp?.value;
    const height = resp?.height ? parseInt(resp.height, 10) : 0;
    // if no value or height==0, there is no winner on this chain
    if (!b64 || !height) return null;

    // helper to scan a block’s txs and return the first tx whose /tx endpoint works
    const scanHeight = async (H) => {
      if (!H || H < 1) return null;
      const br = await fetch(`${rpcUrl}/block?height=${H}`);
      const bj = await br.json();
      const txs = bj?.result?.block?.data?.txs || [];
      for (const txB64 of txs) {
        try {
          const bytes = base64ToBytes(txB64);
          const hashHex = (await sha256Hex(bytes)).toUpperCase();
          const tr = await fetch(`${rpcUrl}/tx?hash=0x${hashHex}`);
          const tj = await tr.json();
          if (tj?.result) return hashHex;
        } catch {}
      }
      return null;
    };

    const maybeHash = (await scanHeight(height)) || (await scanHeight(height - 1));
    if (maybeHash) {
      storeFinishTxId(drawId, maybeHash);
      return maybeHash;
    }
  } catch {
    // ignore and return null
  }
  return null;
}






