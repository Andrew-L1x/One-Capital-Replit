# One Capital Auto-Investing Testing Checklist

## Smart Contract Testing (L1X Blockchain)

- [ ] **Contract Deployment**
  - [ ] Compile Rust contract to WASM using `cargo build --target wasm32-unknown-unknown --release`
  - [ ] Deploy contract to L1X V2 testnet (https://v2.testnet.l1x.foundation)
  - [ ] Verify contract address is accessible

- [ ] **Vault Creation**
  - [ ] Create an investment vault with a name and description
  - [ ] Set vault rebalancing parameters (drift threshold, rebalance frequency)
  - [ ] Verify vault creation event is emitted
  - [ ] Query vault by ID to confirm data integrity

- [ ] **Asset Allocation**
  - [ ] Add assets to a vault with specific allocation percentages
  - [ ] Verify total allocations equal 100%
  - [ ] Update asset allocations and confirm changes
  - [ ] Remove assets from allocation and verify removal

- [ ] **Deposit/Withdrawal**
  - [ ] Deposit funds into a vault
  - [ ] Verify balance increases correctly
  - [ ] Withdraw funds from a vault
  - [ ] Verify balance decreases correctly

- [ ] **Rebalancing**
  - [ ] Trigger manual rebalance
  - [ ] Verify portfolio is rebalanced according to target allocations
  - [ ] Check rebalance history is recorded

## Backend API Testing

- [ ] **Authentication Endpoints**
  - [ ] Test user registration
  - [ ] Test login/logout
  - [ ] Test JWT token validation
  - [ ] Test web3 wallet authentication
  - [ ] Test firebase authentication

- [ ] **Asset Management**
  - [ ] Get list of supported assets
  - [ ] Get asset details by ID
  - [ ] Get current asset prices
  - [ ] Add support for new assets (admin only)

- [ ] **Vault Management**
  - [ ] Create new vault
  - [ ] Get user's vaults
  - [ ] Get vault details by ID
  - [ ] Update vault settings
  - [ ] Delete vault

- [ ] **Allocation Management**
  - [ ] Add asset allocation to vault
  - [ ] Update asset allocation
  - [ ] Remove asset allocation
  - [ ] Get all allocations for a vault

- [ ] **Take Profit Settings**
  - [ ] Configure take profit settings
  - [ ] Update take profit settings
  - [ ] Get take profit settings for a vault

- [ ] **Rebalancing**
  - [ ] Trigger manual rebalance
  - [ ] Get rebalance history
  - [ ] Get rebalance status

## Frontend Testing

- [ ] **Authentication**
  - [ ] Register new user
  - [ ] Login with email/password
  - [ ] Connect wallet (MetaMask/L1X wallet)
  - [ ] Display user profile information
  - [ ] Logout functionality

- [ ] **Dashboard**
  - [ ] Correctly display portfolio balance
  - [ ] Show portfolio performance metrics
  - [ ] Display asset allocation pie chart
  - [ ] Show performance over different time periods (1d, 1w, 1m, 1y)
  - [ ] Navigate between different dashboard tabs

- [ ] **Vault Management**
  - [ ] Create new vault form
  - [ ] Display list of user's vaults
  - [ ] View vault details
  - [ ] Edit vault settings
  - [ ] Delete vault confirmation

- [ ] **Asset Allocation**
  - [ ] Add assets to portfolio with percentage allocation
  - [ ] Validate total allocation equals 100%
  - [ ] Update allocation percentages
  - [ ] Remove assets from allocation
  - [ ] Display allocation visualization

- [ ] **Take Profit**
  - [ ] Configure take profit triggers
  - [ ] Update take profit settings
  - [ ] View take profit history

- [ ] **Mobile Responsiveness**
  - [ ] Test dashboard on mobile viewport
  - [ ] Test forms and inputs on mobile
  - [ ] Verify charts and visualizations are responsive

## Integration Testing

- [ ] **Blockchain <> Backend Integration**
  - [ ] Backend correctly queries on-chain vault data
  - [ ] Backend submits transactions to blockchain
  - [ ] Event listeners capture on-chain events

- [ ] **Backend <> Frontend Integration**
  - [ ] API requests are properly formatted
  - [ ] Response handling and error states
  - [ ] Real-time updates of data
  - [ ] Authentication flow works end-to-end

## Performance Testing

- [ ] **Backend Performance**
  - [ ] API response times under load
  - [ ] Database query performance
  - [ ] Connection handling

- [ ] **Frontend Performance**
  - [ ] Page load time
  - [ ] Component rendering performance
  - [ ] State management efficiency

## Notes for L1X V2 Testnet Testing

- Use the L1X V2 Testnet RPC endpoint: https://v2.testnet.l1x.foundation
- Request testnet tokens from the L1X faucet before testing
- Document any issues with the L1X toolchain for reporting

This checklist serves as a comprehensive guide for testing all aspects of the One Capital Auto-Investing platform. Each item should be tested thoroughly before deployment to production.