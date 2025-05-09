# One Capital dApp Testing Checklist

This document outlines the test coverage for the One Capital Auto-Investing dApp and serves as a guide for ensuring comprehensive testing.

## Functional Testing

### Wallet Connection
- [ ] Connect with WalletConnect
- [ ] Connect with MetaMask
- [ ] Handle connection failures gracefully
- [ ] Persist wallet sessions
- [ ] Switch between networks
- [ ] Sign authentication messages

### Portfolio/Vault Creation
- [ ] Create new vault through UI
- [ ] Set vault parameters (name, description, rebalance threshold)
- [ ] Add asset allocations
- [ ] Validate total allocation equals 100%
- [ ] Handle contract interactions
- [ ] Verify vault created on-chain

### Vault Operations
- [ ] Deposit funds into vault
- [ ] Withdraw funds from vault
- [ ] Trigger manual rebalance
- [ ] View rebalance history
- [ ] Setup take-profit rules
- [ ] View asset allocation in UI matches blockchain state

### Contract Testing
- [ ] Upload WASM contract file
- [ ] Deploy contract to testnet
- [ ] Test contract methods
- [ ] Verify deployment parameters
- [ ] Handle contract errors gracefully

## E2E Testing

### Dashboard
- [ ] Verify responsive design
- [ ] Test tab navigation
- [ ] Check portfolio balance display
- [ ] Verify chart rendering
- [ ] Test navigation to other pages

### Contract Test Page
- [ ] Test deployment interface
- [ ] Test contract method interface
- [ ] Verify wallet connection status
- [ ] Test form validation
- [ ] Verify transaction feedback

### Vault Creation Page
- [ ] Test form validation
- [ ] Test allocation sliders
- [ ] Verify creation feedback
- [ ] Test navigation back to dashboard

## Unit Testing

### Frontend Components
- [ ] Test React components
- [ ] Test form validation
- [ ] Test async state management
- [ ] Test error handling

### Backend APIs
- [ ] Test auth endpoints
- [ ] Test vault CRUD operations
- [ ] Test allocation management
- [ ] Test price feed integration

### Smart Contracts
- [ ] Test vault creation
- [ ] Test deposit/withdraw
- [ ] Test rebalancing logic
- [ ] Test permission checks
- [ ] Test edge cases

## Performance Testing

- [ ] Load testing for concurrent users
- [ ] Response time for critical operations
- [ ] Contract gas optimization
- [ ] UI rendering performance

## Security Testing

- [ ] Authorization checks
- [ ] Input validation
- [ ] Smart contract audit
- [ ] Transaction signing verification
- [ ] API security
- [ ] Data validation

## Documentation

- [ ] API documentation
- [ ] User guide
- [ ] Developer guide
- [ ] Deployment guide
- [ ] Testing guide

## CI/CD Pipeline

- [ ] Build validation
- [ ] TypeScript type checking
- [ ] ESLint validation
- [ ] WASM contract compilation
- [ ] Unit test execution
- [ ] E2E test execution
- [ ] Deployment process