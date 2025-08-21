draw_counter = Variable()
draw_creator = Hash()
draw_token = Hash()
draw_price = Hash()
draw_fee_percent = Hash()
draw_cap = Hash()
draw_tickets = Hash(default_value=[])
draw_pool = Hash()
draw_ticket_count = Hash(default_value=0)
draw_user_counts = Hash(default_value=0)
draw_drawn = Hash(default_value=False)
draw_winner = Hash(default_value='')
draw_admins = Hash(default_value=False)
draw_admin_list = Hash(default_value=[])
draw_lock = Hash(default_value=False)
draw_commit = Hash(default_value='')
draw_revealed = Hash(default_value=False)
draw_reveal_value = Hash(default_value='')
draw_started_ts = Hash(default_value=0)
draw_deadline_ts = Hash(default_value=0)

DrawStarted = LogEvent(
    event="DrawStarted",
    params={
        "draw_id": {"type": int, "idx": True},
        "creator": {"type": str, "idx": True},
        "token": {"type": str, "idx": True},
        "price": {"type": str, "idx": False},
        "fee": {"type": int, "idx": False},
        "cap": {"type": int, "idx": False},
        "commit": {"type": str, "idx": False}
    }
)

TicketPurchased = LogEvent(
    event="TicketPurchased",
    params={
        "draw_id": {"type": int, "idx": True},
        "buyer": {"type": str, "idx": True},
        "amount": {"type": str, "idx": False}
    }
)

DrawFinished = LogEvent(
    event="DrawFinished",
    params={
        "draw_id": {"type": int, "idx": True},
        "winner": {"type": str, "idx": True},
        "prize": {"type": str, "idx": False},
        "fee": {"type": str, "idx": False},
        "reveal": {"type": str, "idx": False}
    }
)

token_interface = [
    importlib.Func('transfer_from', args=('amount', 'to', 'main_account')),
    importlib.Func('transfer', args=('amount', 'to'))
]

@construct
def init():
    draw_counter.set(0)

def require_draw_exists(did: int):
    creator = draw_creator[did]
    assert creator is not None, "Draw does not exist"
    return creator

def token_module_for_draw(did: int):
    name = draw_token[did]
    tok = importlib.import_module(name)
    assert importlib.enforce_interface(tok, token_interface), "Token interface mismatch"
    return tok

def key_uc(did: int, user: str):
    return f"{did}|{user}"

def key_admin(did: int, user: str):
    return f"{did}|{user}"

def is_admin_internal(did: int, who: str):
    return who == draw_creator[did] or draw_admins[key_admin(did, who)] == True

def lock_enter(did: int):
    assert draw_lock[did] == False, "Reentrancy detected"
    draw_lock[did] = True

def lock_exit(did: int):
    draw_lock[did] = False

def is_hex64(s: str):
    if not isinstance(s, str):
        return False
    if len(s) != 64:
        return False
    i = 0
    while i < 64:
        ch = s[i]
        ok = False
        if '0' <= ch <= '9':
            ok = True
        if 'a' <= ch <= 'f':
            ok = True
        if 'A' <= ch <= 'F':
            ok = True
        if not ok:
            return False
        i += 1
    return True

def hex_to_int(s: str):
    n = 0
    i = 0
    while i < len(s):
        ch = s[i]
        v = 0
        if '0' <= ch <= '9':
            v = ord(ch) - 48
        elif 'a' <= ch <= 'f':
            v = ord(ch) - 87
        elif 'A' <= ch <= 'F':
            v = ord(ch) - 55
        else:
            assert False, "Invalid hex"
        n = n * 16 + v
        i += 1
    return n

def mix(a: int, b: int):
    return (a ^ (b * 1469598103934665603)) % (2**256)

def fallback_seed(did: int):
    base = 0
    c = draw_commit[did]
    if is_hex64(c):
        base = hex_to_int(c)
    base = mix(base, did)
    base = mix(base, draw_ticket_count[did])
    now_hex = hashlib.sha256(str(now))
    base = mix(base, hex_to_int(now_hex))
    return base

@export
def start_draw(token_contract: str, price: str, fee: int, cap: int, commit: str):
    assert isinstance(token_contract, str), "Invalid token"
    assert isinstance(price, str) and len(price) > 0, "Invalid price"
    assert fee >= 0 and fee <= 100, "Fee must be 0..100"
    assert cap >= 0, "Cap must be >= 0"
    assert is_hex64(commit), "Invalid commit"
    tok = importlib.import_module(token_contract)
    assert importlib.enforce_interface(tok, token_interface), "Token interface mismatch"
    p = decimal(price)
    assert p > decimal("0"), "Price must be > 0"
    did = draw_counter.get() + 1
    draw_counter.set(did)
    draw_creator[did] = ctx.caller
    draw_token[did] = token_contract
    draw_price[did] = p
    draw_fee_percent[did] = fee
    draw_cap[did] = cap
    draw_tickets[did] = []
    draw_pool[did] = decimal("0")
    draw_ticket_count[did] = 0
    draw_drawn[did] = False
    draw_winner[did] = ''
    draw_admin_list[did] = []
    draw_lock[did] = False
    draw_commit[did] = commit
    draw_revealed[did] = False
    draw_reveal_value[did] = ''
    draw_started_ts[did] = now
    draw_deadline_ts[did] = now + datetime.timedelta(days=30)
    DrawStarted({
        "draw_id": did,
        "creator": ctx.caller,
        "token": token_contract,
        "price": str(p),
        "fee": fee,
        "cap": cap,
        "commit": commit
    })
    return did

@export
def add_admin(draw_id: int, who: str):
    require_draw_exists(draw_id)
    assert isinstance(who, str), "Invalid address"
    assert is_admin_internal(draw_id, ctx.caller), "Only creator or admin"
    if who != draw_creator[draw_id] and draw_admins[key_admin(draw_id, who)] != True:
        draw_admins[key_admin(draw_id, who)] = True
        lst = draw_admin_list[draw_id]
        lst.append(who)
        draw_admin_list[draw_id] = lst

@export
def remove_admin(draw_id: int, who: str):
    require_draw_exists(draw_id)
    assert is_admin_internal(draw_id, ctx.caller), "Only creator or admin"
    if who == draw_creator[draw_id]:
        return
    if draw_admins[key_admin(draw_id, who)] == True:
        draw_admins[key_admin(draw_id, who)] = False
        lst = draw_admin_list[draw_id]
        new_lst = []
        for a in lst:
            if a != who:
                new_lst.append(a)
        draw_admin_list[draw_id] = new_lst

@export
def is_admin(draw_id: int, who: str):
    require_draw_exists(draw_id)
    return is_admin_internal(draw_id, who)

@export
def get_admins(draw_id: int):
    require_draw_exists(draw_id)
    lst = draw_admin_list[draw_id]
    result = [draw_creator[draw_id]]
    for a in lst:
        if a != draw_creator[draw_id]:
            result.append(a)
    return result

@export
def buy_ticket(draw_id: int):
    buy_tickets(draw_id, 1)

@export
def buy_tickets(draw_id: int, count: int):
    require_draw_exists(draw_id)
    assert not draw_drawn[draw_id], "Draw already finished"
    assert isinstance(count, int) and count > 0, "Count must be a positive integer"
    assert count <= 100, "Too many tickets in one tx"
    lock_enter(draw_id)
    price_dec = draw_price[draw_id]
    cap = draw_cap[draw_id]
    k = key_uc(draw_id, ctx.caller)
    prev = draw_user_counts[k]
    if cap > 0:
        assert prev + count <= cap, "Ticket limit reached"
    total = price_dec * decimal(str(count))
    tok = token_module_for_draw(draw_id)
    tok.transfer_from(amount=total, to=ctx.this, main_account=ctx.caller)
    draw_user_counts[k] = prev + count
    lst = draw_tickets[draw_id]
    i = 0
    while i < count:
        lst.append(ctx.caller)
        i += 1
    draw_tickets[draw_id] = lst
    draw_ticket_count[draw_id] = draw_ticket_count[draw_id] + count
    draw_pool[draw_id] = draw_pool[draw_id] + total
    TicketPurchased({
        "draw_id": draw_id,
        "buyer": ctx.caller,
        "amount": str(total)
    })
    lock_exit(draw_id)

@export
def finish_draw(draw_id: int, reveal: str):
    require_draw_exists(draw_id)
    assert is_admin_internal(draw_id, ctx.caller), "Only creator or admin can finish"
    assert not draw_drawn[draw_id], "Already finished"
    assert draw_ticket_count[draw_id] > 0, "No tickets sold"
    assert isinstance(reveal, str), "Reveal must be a string"
    assert is_hex64(draw_commit[draw_id]), "Missing commit"

    calc = hashlib.sha256(reveal)
    assert calc == draw_commit[draw_id], "Bad reveal"

    domain = reveal + "|" + str(draw_id) + "|" + str(draw_ticket_count[draw_id])
    seed_hex = hashlib.sha256(domain)
    n = hex_to_int(seed_hex)

    lst = draw_tickets[draw_id]
    idx = n % len(lst)
    winner = lst[idx]

    lock_enter(draw_id)
    pot = draw_pool[draw_id]
    pct = draw_fee_percent[draw_id]
    fee_amt = (pot * decimal(str(pct))) / decimal("100")
    prize_amt = pot - fee_amt

    draw_drawn[draw_id] = True
    draw_winner[draw_id] = winner
    draw_pool[draw_id] = decimal("0")
    draw_revealed[draw_id] = True
    draw_reveal_value[draw_id] = reveal

    tok = token_module_for_draw(draw_id)
    if prize_amt > decimal("0"):
        tok.transfer(amount=prize_amt, to=winner)
    if fee_amt > decimal("0"):
        tok.transfer(amount=fee_amt, to=draw_creator[draw_id])

    DrawFinished({
        "draw_id": draw_id,
        "winner": winner,
        "prize": str(prize_amt),
        "fee": str(fee_amt),
        "reveal": reveal
    })
    lock_exit(draw_id)

@export
def force_finish_expired(draw_id: int):
    require_draw_exists(draw_id)
    assert not draw_drawn[draw_id], "Already finished"
    assert draw_ticket_count[draw_id] > 0, "No tickets sold"
    assert now >= draw_deadline_ts[draw_id], "Not expired"

    n = fallback_seed(draw_id)
    lst = draw_tickets[draw_id]
    idx = n % len(lst)
    winner = lst[idx]

    lock_enter(draw_id)
    pot = draw_pool[draw_id]
    pct = draw_fee_percent[draw_id]
    fee_amt = (pot * decimal(str(pct))) / decimal("100")
    prize_amt = pot - fee_amt

    draw_drawn[draw_id] = True
    draw_winner[draw_id] = winner
    draw_pool[draw_id] = decimal("0")

    tok = token_module_for_draw(draw_id)
    if prize_amt > decimal("0"):
        tok.transfer(amount=prize_amt, to=winner)
    if fee_amt > decimal("0"):
        tok.transfer(amount=fee_amt, to=draw_creator[draw_id])

    DrawFinished({
        "draw_id": draw_id,
        "winner": winner,
        "prize": str(prize_amt),
        "fee": str(fee_amt),
        "reveal": ""
    })
    lock_exit(draw_id)

@export
def get_draw_info(draw_id: int):
    require_draw_exists(draw_id)
    return {
        "creator": draw_creator[draw_id],
        "token": draw_token[draw_id],
        "price": str(draw_price[draw_id]),
        "fee": draw_fee_percent[draw_id],
        "cap": draw_cap[draw_id],
        "tickets": draw_ticket_count[draw_id],
        "pool": str(draw_pool[draw_id]),
        "drawn": draw_drawn[draw_id],
        "winner": draw_winner[draw_id],
        "commit": draw_commit[draw_id],
        "revealed": draw_revealed[draw_id],
        "started_ts": draw_started_ts[draw_id],
        "deadline_ts": draw_deadline_ts[draw_id]
    }

@export
def get_pool(draw_id: int):
    require_draw_exists(draw_id)
    return str(draw_pool[draw_id])

@export
def get_ticket_count(draw_id: int):
    require_draw_exists(draw_id)
    return draw_ticket_count[draw_id]

@export
def get_winner(draw_id: int):
    require_draw_exists(draw_id)
    return draw_winner[draw_id]

@export
def get_my_tickets(draw_id: int):
    require_draw_exists(draw_id)
    return draw_user_counts[key_uc(draw_id, ctx.caller)]

@export
def has_bought(draw_id: int, who: str):
    require_draw_exists(draw_id)
    return draw_user_counts[key_uc(draw_id, who)] > 0

@export
def active_draw_ids():
    res = []
    last = draw_counter.get()
    i = 1
    while i <= last:
        if draw_creator[i] is not None and draw_drawn[i] == False:
            res.append(i)
        i += 1
    return res