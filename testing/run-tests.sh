#!/bin/bash

# Run-Tests Script for One Capital dApp
# This script automates running various test suites for the application

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${YELLOW}One Capital dApp Testing Suite${NC}"
echo "===================================="

# Install test dependencies if needed
echo -e "${YELLOW}Checking test dependencies...${NC}"

# Check for Mocha and Chai
if ! npm list mocha > /dev/null 2>&1 || ! npm list chai > /dev/null 2>&1; then
  echo "Installing Mocha and Chai for JavaScript tests..."
  npm install --save-dev mocha chai
fi

# Check for Playwright
if ! npm list @playwright/test > /dev/null 2>&1; then
  echo "Installing Playwright for E2E tests..."
  npm install --save-dev @playwright/test
  npx playwright install --with-deps
fi

# Run functional tests
run_functional_tests() {
  echo -e "\n${YELLOW}Running Functional Tests...${NC}"
  
  # Run the wallet connection test
  echo -e "\n${YELLOW}Wallet Connection Tests:${NC}"
  npx mocha testing/functional/walletConnectTest.js || {
    echo -e "${RED}Wallet connection tests failed!${NC}"
    return 1
  }
  
  # Run the portfolio creation test
  echo -e "\n${YELLOW}Portfolio Creation Tests:${NC}"
  npx mocha testing/functional/portfolioCreationTest.js || {
    echo -e "${RED}Portfolio creation tests failed!${NC}"
    return 1
  }
  
  # Run the vault operations test
  echo -e "\n${YELLOW}Vault Operations Tests:${NC}"
  npx mocha testing/functional/vaultOperationsTest.js || {
    echo -e "${RED}Vault operations tests failed!${NC}"
    return 1
  }
  
  echo -e "${GREEN}All functional tests passed!${NC}"
  return 0
}

# Run E2E tests
run_e2e_tests() {
  echo -e "\n${YELLOW}Running E2E Tests...${NC}"
  
  cd testing/e2e
  npx playwright test || {
    echo -e "${RED}E2E tests failed!${NC}"
    cd ../..
    return 1
  }
  cd ../..
  
  echo -e "${GREEN}All E2E tests passed!${NC}"
  return 0
}

# Run contract tests
run_contract_tests() {
  echo -e "\n${YELLOW}Running Smart Contract Tests...${NC}"
  
  cd rust-contracts
  cargo test || {
    echo -e "${RED}Smart contract tests failed!${NC}"
    cd ..
    return 1
  }
  cd ..
  
  echo -e "${GREEN}All smart contract tests passed!${NC}"
  return 0
}

# Main execution
echo -e "\n${YELLOW}Choose test suite to run:${NC}"
echo "1. All tests"
echo "2. Functional tests only"
echo "3. E2E tests only"
echo "4. Smart contract tests only"
read -p "Enter your choice (1-4): " choice

case $choice in
  1)
    run_functional_tests
    functional_result=$?
    
    run_e2e_tests
    e2e_result=$?
    
    run_contract_tests
    contract_result=$?
    
    if [ $functional_result -eq 0 ] && [ $e2e_result -eq 0 ] && [ $contract_result -eq 0 ]; then
      echo -e "\n${GREEN}All tests passed successfully!${NC}"
      exit 0
    else
      echo -e "\n${RED}Some tests failed. Check the logs above for details.${NC}"
      exit 1
    fi
    ;;
  2)
    run_functional_tests
    if [ $? -eq 0 ]; then
      echo -e "\n${GREEN}All functional tests passed successfully!${NC}"
      exit 0
    else
      echo -e "\n${RED}Some functional tests failed. Check the logs above for details.${NC}"
      exit 1
    fi
    ;;
  3)
    run_e2e_tests
    if [ $? -eq 0 ]; then
      echo -e "\n${GREEN}All E2E tests passed successfully!${NC}"
      exit 0
    else
      echo -e "\n${RED}Some E2E tests failed. Check the logs above for details.${NC}"
      exit 1
    fi
    ;;
  4)
    run_contract_tests
    if [ $? -eq 0 ]; then
      echo -e "\n${GREEN}All smart contract tests passed successfully!${NC}"
      exit 0
    else
      echo -e "\n${RED}Some smart contract tests failed. Check the logs above for details.${NC}"
      exit 1
    fi
    ;;
  *)
    echo -e "${RED}Invalid choice. Exiting.${NC}"
    exit 1
    ;;
esac