# Xian Network Smart Contract Guide

## Overview

This guide outlines the Python smart contract requirements for the Decentralized Voting System dapp. The frontend expects a **single smart contract** named `"con_no_sec_w_weight_fix_int"` that handles **all polls** in the system. This is a centralized voting contract architecture where one contract manages multiple polls.

## Contract Name

```
con_no_sec_w_weight_fix_int
```

## Required Methods

### 1. `create_poll`

**Purpose**: Creates a new voting poll on the blockchain

**Parameters** (received as kwargs):

```python
{
    "title": str,           # Poll title/question
    "options": List[str],   # Array of voting options
    "endDate": str          # ISO date string (optional, defaults to 7 days)
}
```

**Expected Behavior**:

- Generate a unique poll ID
- Store poll data in contract state
- Emit an event for poll creation
- Return poll ID and creation timestamp

**State Storage**:

```python
# Example state structure
polls = {
    "poll_id": {
        "title": "What's the best programming language?",
        "options": ["Solidity", "Rust", "JavaScript", "Python"],
        "creator": "user_address",
        "created_at": timestamp,
        "end_date": timestamp,
        "total_votes": 0,
        "votes_per_option": {"1": 0, "2": 0, "3": 0, "4": 0},
        "voters": set()  # Track who has voted
    }
}
```

### 2. `vote`

**Purpose**: Submits a vote for a specific poll option

**Parameters** (received as kwargs):

```python
{
    "pollId": int,      # ID of the poll to vote on
    "optionId": int     # ID of the selected option (1-based index)
}
```

**Expected Behavior**:

- Validate poll exists and is still active
- Check if user has already voted
- Increment vote count for selected option
- Record voter address to prevent double voting
- Emit vote event

**Validation Rules**:

- Poll must exist
- Poll must not be expired
- User must not have voted before
- Option ID must be valid

### 3. `get_polls` (Query Method)

**Purpose**: Retrieves all polls or specific poll data

**Parameters** (optional):

```python
{
    "pollId": int,      # Optional: specific poll ID
    "limit": int,       # Optional: number of polls to return
    "offset": int       # Optional: pagination offset
}
```

**Return Format**:

```python
{
    "polls": [
        {
            "id": int,
            "title": str,
            "options": [
                {"id": 1, "text": "Option 1", "votes": 45},
                {"id": 2, "text": "Option 2", "votes": 32}
            ],
            "totalVotes": int,
            "creator": str,
            "createdAt": timestamp,
            "endDate": timestamp,
            "isActive": bool
        }
    ]
}
```

### 4. `get_votes` (Query Method)

**Purpose**: Gets voting results for a specific poll

**Parameters**:

```python
{
    "pollId": int       # ID of the poll
}
```

**Return Format**:

```python
{
    "pollId": int,
    "totalVotes": int,
    "options": [
        {
            "id": int,
            "text": str,
            "votes": int,
            "percentage": float
        }
    ],
    "userVote": int,    # User's vote (if they voted)
    "isActive": bool
}
```

## Data Structures

### Poll Structure

```python
class Poll:
    def __init__(self, title, options, creator, end_date=None):
        self.id = generate_unique_id()
        self.title = title
        self.options = options
        self.creator = creator
        self.created_at = get_current_timestamp()
        self.end_date = end_date or (get_current_timestamp() + 7 * 24 * 60 * 60)  # 7 days
        self.total_votes = 0
        self.votes_per_option = {str(i+1): 0 for i in range(len(options))}
        self.voters = set()
```

### Vote Structure

```python
class Vote:
    def __init__(self, poll_id, option_id, voter):
        self.poll_id = poll_id
        self.option_id = option_id
        self.voter = voter
        self.timestamp = get_current_timestamp()
```

## State Management

### Contract State Keys

```python
# Main state keys
"polls"              # Dictionary of all polls
"poll_counter"       # Counter for generating unique poll IDs
"user_votes"         # Mapping of user_address -> {poll_id -> option_id}
"poll_voters"        # Mapping of poll_id -> set of voter addresses
```

### State Access Patterns

```python
# Store poll
state[f"polls:{poll_id}"] = poll_data

# Get poll
poll_data = state.get(f"polls:{poll_id}")

# Store user vote
state[f"user_votes:{user_address}:{poll_id}"] = option_id

# Check if user voted
has_voted = f"user_votes:{user_address}:{poll_id}" in state
```

## Error Handling

### Common Error Cases

1. **Poll not found**: When `pollId` doesn't exist
2. **Poll expired**: When current time > `end_date`
3. **Already voted**: When user has already voted on this poll
4. **Invalid option**: When `optionId` is out of range
5. **Invalid parameters**: When required fields are missing

### Error Response Format

```python
{
    "error": str,           # Error message
    "error_code": str,      # Error code for frontend handling
    "details": dict         # Additional error details
}
```

## Events

### Poll Created Event

```python
{
    "event": "poll_created",
    "poll_id": int,
    "title": str,
    "creator": str,
    "created_at": timestamp
}
```

### Vote Submitted Event

```python
{
    "event": "vote_submitted",
    "poll_id": int,
    "option_id": int,
    "voter": str,
    "timestamp": timestamp
}
```

## Security Considerations

### Access Control

- Only poll creator can modify poll details
- Anyone can vote on active polls
- Users can only vote once per poll

### Data Validation

- Validate all input parameters
- Check poll expiration dates
- Prevent double voting
- Sanitize user inputs

### Gas Optimization

- Use efficient data structures
- Minimize state reads/writes
- Batch operations where possible

## Architecture Decision: Single Contract for All Polls

The dapp uses a **centralized voting contract architecture** where one contract manages all polls. This approach was chosen because:

### Why Single Contract?

- **Frontend Design**: The UI expects one contract name (`"con_no_sec_w_weight_fix_int"`)
- **Simplicity**: Easier to deploy and manage
- **Cost Efficiency**: Lower gas costs for deployment
- **Centralized Governance**: Easier to implement global features
- **State Management**: Simpler to track all polls in one place

### Alternative: Contract per Poll

While possible, creating a separate contract for each poll would require:

- More complex deployment logic
- Higher gas costs
- More complex frontend integration
- Individual contract management

## Example Contract Structure

```python
class VotingContract:
    def __init__(self):
        self.polls = {}           # All polls stored in one contract
        self.poll_counter = 0     # Global poll ID counter
        self.user_votes = {}      # Track all user votes across all polls

    def create_poll(self, title, options, end_date=None):
        # Creates a new poll in this contract
        poll_id = self.generate_poll_id()
        self.polls[poll_id] = Poll(title, options, end_date)
        return poll_id

    def vote(self, poll_id, option_id):
        # Votes on a specific poll within this contract
        poll = self.polls[poll_id]
        poll.add_vote(option_id, msg.sender)

    def get_polls(self, poll_id=None, limit=None, offset=None):
        # Returns polls from this contract
        pass

    def get_votes(self, poll_id):
        # Returns votes for a specific poll in this contract
        pass
```

## Deployment Requirements

### Contract Name

The contract must be deployed with the exact name: `"con_no_sec_w_weight_fix_int"`

### Network

Deploy to Xian testnet: `https://node.xian.org`

### Initial State

```python
{
    "poll_counter": 0,
    "polls": {},
    "user_votes": {}
}
```

## Testing Checklist

- [ ] Create poll with valid data
- [ ] Create poll with invalid data (should fail)
- [ ] Vote on active poll
- [ ] Vote on expired poll (should fail)
- [ ] Vote twice on same poll (should fail)
- [ ] Vote with invalid option ID (should fail)
- [ ] Get polls list
- [ ] Get specific poll data
- [ ] Get vote results
- [ ] Handle edge cases (empty polls, single option, etc.)

## Integration Notes

The frontend expects:

1. Contract name: `"con_no_sec_w_weight_fix_int"`
2. RPC endpoint: `https://node.xian.org`
3. All methods to return JSON-serializable data
4. Error responses to be properly formatted
5. Transaction responses to include transaction hash and status

This contract structure will enable the dapp to function as a fully decentralized voting system on the Xian network.

## Xian Network Specific Notes

### Query Method Limitations

**Important**: Xian contracts have query methods (like `get_polls`, `get_votes`) but they are **NOT accessible through the standard RPC query interface**. This is a limitation of the Xian network architecture.

#### What Works:

- ✅ **Transaction methods**: `create_poll`, `vote` (via `sendTransaction`)
- ✅ **State queries**: Direct contract state access
- ✅ **Event parsing**: Reading contract events

#### What Doesn't Work:

- ❌ **Query method calls**: `get_polls`, `get_votes` via RPC
- ❌ **Direct method invocation**: Through standard RPC interface

#### Alternative Approaches:

1. **State Reading**: Query contract state directly and parse the data
2. **Event Parsing**: Read contract events to reconstruct poll data
3. **Custom Indexer**: Build a separate service to index contract data
4. **Frontend State**: Maintain poll data in frontend state

### Updated Integration Strategy

Since query methods aren't available via RPC, the dapp should:

1. **Use transaction methods** for creating polls and voting
2. **Read contract state** to get initial data
3. **Maintain local state** for real-time updates
4. **Parse events** for historical data

### Example State Query

```javascript
// Instead of calling get_polls, query contract state directly
const stateData = await fetch(
  `${rpcUrl}/abci_query?path=%22/get/con_no_sec_w_weight_fix_int%22`
);
```

This limitation is specific to Xian network architecture and differs from other blockchains like Ethereum.
