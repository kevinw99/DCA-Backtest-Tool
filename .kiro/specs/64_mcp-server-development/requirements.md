# Requirements: MCP Server for DCA Backtest Tool

**Spec Number**: 64
**Date**: January 2025
**Status**: Planning
**Priority**: High

---

## Problem Statement

The Grid-Based DCA Backtest Tool currently requires:
- Manual interaction through web UI
- Direct API calls via curl for automation
- No standardized way for AI assistants to interact with the tool

### Current Limitations

1. **No AI Assistant Integration**: Claude, ChatGPT, and other AI assistants cannot directly run backtests or analyze strategies
2. **Manual Parameter Entry**: Users must manually configure all parameters through the UI
3. **No Conversational Interface**: Cannot ask "What's the best DCA strategy for NVDA?" and get automated analysis
4. **Workflow Friction**: AI assists with strategy ideation but cannot execute backtests
5. **Limited Automation**: Batch analysis requires scripting or manual UI clicks

### Use Case Examples

**Desired Workflows**:
- "Run a DCA backtest for TSLA from 2020-2024 with 10% grid spacing"
- "Compare 5 different grid spacings for NVDA and show me which performs best"
- "Analyze the portfolio performance of FAANG stocks with beta-adjusted capital"
- "What's the DCA Suitability Score for PLTR?"
- "Show me all available stocks in the database"

---

## Proposed Solution

Develop an **MCP (Model Context Protocol) Server** that exposes the DCA Backtest Tool's functionality to AI assistants.

### What is MCP?

Model Context Protocol (MCP) is an open protocol developed by Anthropic that enables:
- AI assistants to safely interact with external tools
- Standardized tool definitions and parameters
- Secure, sandboxed execution of commands
- Integration with Claude Code, Claude Desktop, and other MCP-compatible clients

### Architecture

```
┌─────────────────────┐
│   AI Assistant      │
│  (Claude, etc.)     │
└──────────┬──────────┘
           │ MCP Protocol
           ▼
┌─────────────────────┐
│   MCP Server        │
│  (Python/FastMCP)   │
└──────────┬──────────┘
           │ HTTP/REST
           ▼
┌─────────────────────┐
│  DCA Backend API    │
│  (Port 3001)        │
└─────────────────────┘
```

---

## Functional Requirements

### FR-1: Core Backtest Tools

#### FR-1.1: Single Stock DCA Backtest
**Tool**: `run_dca_backtest`

**Parameters**:
- `symbol` (required): Stock ticker (e.g., "TSLA")
- `start_date` (required): ISO format (e.g., "2020-01-01")
- `end_date` (required): ISO format (e.g., "2024-12-31")
- `initial_capital` (optional, default: 10000)
- `grid_spacing` (optional, default: 0.10)
- `profit_target` (optional, default: 0.05)
- `enable_momentum_sell` (optional, default: false)
- `enable_trailing_stop_buy` (optional, default: false)
- ... (all DCA parameters)

**Returns**:
- Total return %
- Max drawdown %
- Number of trades
- Final capital
- DCA Suitability Score
- Transaction log summary

---

#### FR-1.2: Portfolio Backtest
**Tool**: `run_portfolio_backtest`

**Parameters**:
- `stocks` (required): Array of {symbol, allocation%}
- `start_date`, `end_date` (required)
- `initial_capital` (optional)
- `enable_beta_capital_allocation` (optional)
- ... (portfolio parameters)

**Returns**:
- Portfolio-level metrics
- Per-stock performance
- Capital allocation breakdown

---

#### FR-1.3: Batch Parameter Optimization
**Tool**: `run_batch_optimization`

**Parameters**:
- `symbol` (required)
- `start_date`, `end_date` (required)
- `parameter_grid` (required): Object defining ranges
  - `grid_spacing`: [0.05, 0.10, 0.15]
  - `profit_target`: [0.03, 0.05, 0.07]
  - ... (parameters to vary)

**Returns**:
- Best performing configuration
- All results ranked by return
- Comparison table

---

### FR-2: Stock Data Tools

#### FR-2.1: List Available Stocks
**Tool**: `list_stocks`

**Parameters**:
- `limit` (optional, default: 100)
- `offset` (optional, default: 0)

**Returns**:
- Array of stock symbols
- Total count

---

#### FR-2.2: Get Stock Info
**Tool**: `get_stock_info`

**Parameters**:
- `symbol` (required)

**Returns**:
- Company name
- Sector
- Market cap
- Beta
- Available date range

---

#### FR-2.3: Calculate Beta
**Tool**: `calculate_beta`

**Parameters**:
- `symbol` (required)
- `period` (optional, default: 252 days)

**Returns**:
- Beta value
- Correlation coefficient
- Date range used

---

### FR-3: Analysis Tools

#### FR-3.1: Compare Strategies
**Tool**: `compare_strategies`

**Parameters**:
- `symbol` (required)
- `strategies` (required): Array of strategy configurations
- `start_date`, `end_date` (required)

**Returns**:
- Side-by-side comparison
- Best strategy recommendation
- Risk-adjusted metrics

---

#### FR-3.2: Get DCA Suitability Score
**Tool**: `get_dca_suitability_score`

**Parameters**:
- `backtest_results` (required): Results from previous backtest

**Returns**:
- Overall score (0-100)
- Component scores:
  - Trade Activity Score
  - Mean Reversion Score
  - Capital Efficiency Score
  - Grid Utilization Score

---

### FR-4: Server Management

#### FR-4.1: Health Check
**Tool**: `health_check`

**Returns**:
- Backend API status
- Database connection status
- Server uptime

---

#### FR-4.2: List Tools
**Tool**: `list_tools` (built-in MCP)

**Returns**:
- All available tools
- Parameter schemas
- Usage examples

---

## Non-Functional Requirements

### NFR-1: Performance
- Tool responses within 30 seconds (backtests)
- Stock data queries within 2 seconds
- Support concurrent requests (5+)

### NFR-2: Reliability
- Graceful error handling
- Clear error messages for AI to interpret
- Retry logic for transient failures

### NFR-3: Security
- Local-only by default (localhost:3001)
- No authentication required for local use
- Rate limiting to prevent abuse

### NFR-4: Usability
- Clear tool descriptions for AI understanding
- Example usage in tool schemas
- Structured JSON responses

### NFR-5: Maintainability
- Python-based (FastMCP framework)
- Type hints throughout
- Comprehensive logging
- Unit tests for each tool

---

## Success Criteria

1. ✅ AI assistant can run single stock backtests via natural language
2. ✅ AI assistant can optimize parameters across ranges
3. ✅ AI assistant can compare multiple strategies
4. ✅ All existing backend features accessible via MCP
5. ✅ Clear error messages when requests fail
6. ✅ Complete tool documentation and examples
7. ✅ Integration with Claude Code works seamlessly

---

## Out of Scope

### Phase 1 (Current Spec)
- ❌ Web UI for MCP server configuration
- ❌ Authentication/authorization system
- ❌ Multi-user support
- ❌ Streaming real-time backtest progress
- ❌ Chart generation (MCP servers don't render graphics)
- ❌ Email notifications
- ❌ Database write operations (read-only for safety)

### Future Enhancements (Phase 2+)
- Remote MCP server deployment
- API key authentication
- WebSocket support for long-running backtests
- Caching layer for repeated queries
- Prometheus metrics export

---

## User Personas

### Persona 1: Strategy Researcher
**Goal**: Quickly test many parameter combinations
**Usage**: "Optimize grid spacing for TSLA across 5%, 10%, and 15% with profit targets from 3-7%"

### Persona 2: Portfolio Manager
**Goal**: Analyze diversified DCA portfolios
**Usage**: "Backtest a 10-stock tech portfolio with beta-adjusted capital allocation"

### Persona 3: Algorithm Developer
**Goal**: Validate new DCA strategy enhancements
**Usage**: "Compare baseline DCA vs. momentum-enabled DCA for NVDA"

### Persona 4: Casual Investor
**Goal**: Get quick insights on stock suitability
**Usage**: "Is PLTR a good candidate for DCA investing?"

---

## Dependencies

### External Dependencies
1. **FastMCP** - Python MCP framework by Anthropic
2. **aiohttp** or **httpx** - Async HTTP client for backend API
3. **pydantic** - Data validation
4. **python-dotenv** - Configuration management

### Internal Dependencies
1. **DCA Backend API** must be running (port 3001)
2. **stocks.db** must be accessible
3. All existing backend endpoints must be functional

---

## Timeline

**Phase 1: Core MCP Server** (Est: 8-12 hours)
- Single stock backtest tool
- Portfolio backtest tool
- Stock data tools
- Basic error handling

**Phase 2: Advanced Features** (Est: 4-6 hours)
- Batch optimization tool
- Strategy comparison tool
- DCA Suitability Score calculation
- Comprehensive testing

**Phase 3: Documentation & Polish** (Est: 2-3 hours)
- Complete tool documentation
- Usage examples
- Integration guide
- Error handling refinement

**Total**: 14-21 hours

---

## Risks and Mitigation

| Risk | Impact | Probability | Mitigation |
|------|--------|-------------|------------|
| Backend API changes break MCP server | High | Low | Version backend API, use schemas |
| Long-running backtests timeout | Medium | Medium | Implement async handling, progress callbacks |
| AI misinterprets tool parameters | Medium | Medium | Clear parameter descriptions, examples |
| MCP protocol changes | Low | Low | Use stable FastMCP framework |
| Performance bottleneck on concurrent requests | Medium | Low | Implement request queuing |

---

## References

- [MCP Protocol Documentation](https://modelcontextprotocol.io/)
- [FastMCP Framework](https://github.com/jlowin/fastmcp)
- [Anthropic MCP Specification](https://spec.modelcontextprotocol.io/)
- DCA Backend API documentation (internal)
- `.kiro/specs/` - Previous implementation specs

---

## Acceptance Criteria

### Minimum Viable Product (MVP)
- [ ] MCP server starts and connects to backend API
- [ ] `run_dca_backtest` tool works for single stocks
- [ ] `list_stocks` tool returns available tickers
- [ ] AI assistant can successfully run backtests
- [ ] Error messages are clear and actionable
- [ ] Basic documentation exists

### Complete Implementation
- [ ] All 10+ tools implemented
- [ ] Portfolio and batch backtests supported
- [ ] Comprehensive error handling
- [ ] Unit tests for all tools
- [ ] Integration tests with Claude Code
- [ ] Complete usage documentation
- [ ] Example prompts for common workflows
