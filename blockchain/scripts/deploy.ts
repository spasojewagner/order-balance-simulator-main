// scripts/deploy.ts - Smart Contract Deployment Script

import { ethers } from 'hardhat';
import { HybridDEXSettlement } from '../typechain-types';

interface DeploymentConfig {
  network: string;
  feeRecipient: string;
  gasLimit: number;
  gasPrice?: string;
}

const DEPLOYMENT_CONFIGS: Record<string, DeploymentConfig> = {
  // Ethereum Mainnet
  mainnet: {
    network: 'mainnet',
    feeRecipient: '0x0000000000000000000000000000000000000000', // REPLACE WITH ACTUAL ADDRESS
    gasLimit: 5000000,
    gasPrice: '20000000000' // 20 gwei
  },
  
  // Ethereum Goerli Testnet
  goerli: {
    network: 'goerli',
    feeRecipient: '0x0000000000000000000000000000000000000000', // REPLACE WITH ACTUAL ADDRESS
    gasLimit: 5000000,
    gasPrice: '10000000000' // 10 gwei
  },
  
  // Ethereum Sepolia Testnet
  sepolia: {
    network: 'sepolia',
    feeRecipient: '0x0000000000000000000000000000000000000000', // REPLACE WITH ACTUAL ADDRESS
    gasLimit: 5000000,
    gasPrice: '10000000000' // 10 gwei
  },
  
  // Polygon Mainnet
  polygon: {
    network: 'polygon',
    feeRecipient: '0x0000000000000000000000000000000000000000', // REPLACE WITH ACTUAL ADDRESS
    gasLimit: 5000000,
    gasPrice: '30000000000' // 30 gwei
  },
  
  // Polygon Mumbai Testnet
  mumbai: {
    network: 'mumbai',
    feeRecipient: '0x0000000000000000000000000000000000000000', // REPLACE WITH ACTUAL ADDRESS
    gasLimit: 5000000,
    gasPrice: '10000000000' // 10 gwei
  }
};

async function deployDEXContract(config: DeploymentConfig): Promise<HybridDEXSettlement> {
  console.log(`\n🚀 Deploying HybridDEXSettlement to ${config.network}...`);
  
  // Get deployer account
  const [deployer] = await ethers.getSigners();
  console.log(`📝 Deploying with account: ${deployer.address}`);
  
  // Check balance
  const balance = await deployer.getBalance();
  console.log(`💰 Account balance: ${ethers.formatEther(balance)} ETH`);
  
  // Deploy contract
  const HybridDEXSettlement = await ethers.getContractFactory('HybridDEXSettlement');
  
  const contract = await HybridDEXSettlement.deploy(
    config.feeRecipient,
    {
      gasLimit: config.gasLimit,
      gasPrice: config.gasPrice
    }
  );
  
  console.log(`⏳ Deployment transaction: ${contract.deploymentTransaction()?.hash}`);
  
  // Wait for deployment
  await contract.waitForDeployment();
  const address = await contract.getAddress();
  
  console.log(`✅ HybridDEXSettlement deployed to: ${address}`);
  
  return contract;
}

async function deployMockTokens(config: DeploymentConfig): Promise<{
  mockUSDT: string;
  mockUSDC: string;
  mockBTC: string;
}> {
  console.log(`\n🪙 Deploying Mock Tokens to ${config.network}...`);
  
  const [deployer] = await ethers.getSigners();
  
  // Deploy Mock USDT
  const MockERC20 = await ethers.getContractFactory('MockERC20');
  
  const mockUSDT = await MockERC20.deploy(
    'Mock Tether USD',
    'USDT',
    6, // 6 decimals like real USDT
    ethers.parseUnits('1000000', 6), // 1M initial supply
    {
      gasLimit: config.gasLimit,
      gasPrice: config.gasPrice
    }
  );
  await mockUSDT.waitForDeployment();
  
  const mockUSDC = await MockERC20.deploy(
    'Mock USD Coin',
    'USDC',
    6, // 6 decimals like real USDC
    ethers.parseUnits('1000000', 6), // 1M initial supply
    {
      gasLimit: config.gasLimit,
      gasPrice: config.gasPrice
    }
  );
  await mockUSDC.waitForDeployment();
  
  const mockBTC = await MockERC20.deploy(
    'Mock Bitcoin',
    'BTC',
    8, // 8 decimals like real BTC
    ethers.parseUnits('21000', 8), // 21k initial supply
    {
      gasLimit: config.gasLimit,
      gasPrice: config.gasPrice
    }
  );
  await mockBTC.waitForDeployment();
  
  const addresses = {
    mockUSDT: await mockUSDT.getAddress(),
    mockUSDC: await mockUSDC.getAddress(),
    mockBTC: await mockBTC.getAddress()
  };
  
  console.log(`✅ Mock USDT deployed to: ${addresses.mockUSDT}`);
  console.log(`✅ Mock USDC deployed to: ${addresses.mockUSDC}`);
  console.log(`✅ Mock BTC deployed to: ${addresses.mockBTC}`);
  
  return addresses;
}

async function verifyContract(contractAddress: string, constructorArgs: any[], network: string) {
  if (network === 'hardhat' || network === 'localhost') {
    console.log('⚠️  Skipping verification on local network');
    return;
  }
  
  console.log(`\n🔍 Verifying contract on ${network}...`);
  
  try {
    await run('verify:verify', {
      address: contractAddress,
      constructorArguments: constructorArgs,
    });
    console.log('✅ Contract verified successfully');
  } catch (error) {
    console.error('❌ Verification failed:', error);
  }
}

async function setupInitialConfiguration(
  contract: HybridDEXSettlement,
  tokenAddresses: any,
  config: DeploymentConfig
) {
  console.log(`\n⚙️  Setting up initial configuration...`);
  
  const [deployer] = await ethers.getSigners();
  
  // Add backend service as authorized operator
  // NOTE: Replace with actual backend service address
  const backendServiceAddress = '0x0000000000000000000000000000000000000000';
  
  if (backendServiceAddress !== '0x0000000000000000000000000000000000000000') {
    const tx = await contract.setOperatorAuthorization(backendServiceAddress, true);
    await tx.wait();
    console.log(`✅ Authorized backend service: ${backendServiceAddress}`);
  }
  
  // Fund deployer with some mock tokens for testing
  if (tokenAddresses.mockUSDT && config.network !== 'mainnet') {
    const MockERC20 = await ethers.getContractFactory('MockERC20');
    const usdtContract = MockERC20.attach(tokenAddresses.mockUSDT);
    
    // Transfer some tokens to deployer for testing
    const testAmount = ethers.parseUnits('10000', 6); // 10k USDT
    console.log(`💰 Minting ${ethers.formatUnits(testAmount, 6)} USDT for testing...`);
  }
  
  console.log('✅ Initial configuration completed');
}

async function saveDeploymentInfo(
  networkName: string,
  contractAddresses: any,
  tokenAddresses: any
) {
  const fs = require('fs');
  const path = require('path');
  
  const deploymentInfo = {
    network: networkName,
    timestamp: new Date().toISOString(),
    contracts: {
      HybridDEXSettlement: contractAddresses.dex,
      ...tokenAddresses
    },
    configuration: {
      feeRecipient: DEPLOYMENT_CONFIGS[networkName]?.feeRecipient,
      feeBasisPoints: 30, // 0.3%
    }
  };
  
  // Save to deployments directory
  const deploymentsDir = path.join(__dirname, '../deployments');
  if (!fs.existsSync(deploymentsDir)) {
    fs.mkdirSync(deploymentsDir, { recursive: true });
  }
  
  const filePath = path.join(deploymentsDir, `${networkName}.json`);
  fs.writeFileSync(filePath, JSON.stringify(deploymentInfo, null, 2));
  
  console.log(`📄 Deployment info saved to: ${filePath}`);
  
  // Also update frontend config
  const frontendConfigPath = path.join(__dirname, '../frontend/src/config/contracts.ts');
  const frontendConfig = `// Auto-generated contract addresses - DO NOT EDIT MANUALLY
// Generated on: ${deploymentInfo.timestamp}

export const CONTRACT_ADDRESSES = {
  DEX_SETTLEMENT: {
    ${networkName}: '${contractAddresses.dex}'
  },
  TOKENS: {
    USDT: {
      ${networkName}: '${tokenAddresses.mockUSDT || '0x0000000000000000000000000000000000000000'}'
    },
    USDC: {
      ${networkName}: '${tokenAddresses.mockUSDC || '0x0000000000000000000000000000000000000000'}'
    },
    BTC: {
      ${networkName}: '${tokenAddresses.mockBTC || '0x0000000000000000000000000000000000000000'}'
    }
  }
};

export const NETWORK_CONFIG = {
  ${networkName}: {
    name: '${networkName}',
    feeRecipient: '${deploymentInfo.configuration.feeRecipient}',
    feeBasisPoints: ${deploymentInfo.configuration.feeBasisPoints}
  }
};
`;
  
  if (fs.existsSync(path.dirname(frontendConfigPath))) {
    fs.writeFileSync(frontendConfigPath, frontendConfig);
    console.log(`📄 Frontend config updated: ${frontendConfigPath}`);
  }
}

// Main deployment function
async function main() {
  const networkName = process.env.HARDHAT_NETWORK || 'localhost';
  console.log(`🌐 Deploying to network: ${networkName}`);
  
  const config = DEPLOYMENT_CONFIGS[networkName];
  if (!config) {
    throw new Error(`No deployment config found for network: ${networkName}`);
  }
  
  try {
    // Deploy main DEX contract
    const dexContract = await deployDEXContract(config);
    const dexAddress = await dexContract.getAddress();
    
    // Deploy mock tokens (only for testnets)
    let tokenAddresses = {};
    if (networkName !== 'mainnet') {
      tokenAddresses = await deployMockTokens(config);
    }
    
    // Setup initial configuration
    await setupInitialConfiguration(dexContract, tokenAddresses, config);
    
    // Verify contracts (skip for local networks)
    if (networkName !== 'localhost' && networkName !== 'hardhat') {
      await verifyContract(dexAddress, [config.feeRecipient], networkName);
      
      if (tokenAddresses.mockUSDT) {
        await verifyContract(
          tokenAddresses.mockUSDT,
          ['Mock Tether USD', 'USDT', 6, ethers.parseUnits('1000000', 6)],
          networkName
        );
      }
    }
    
    // Save deployment information
    await saveDeploymentInfo(networkName, { dex: dexAddress }, tokenAddresses);
    
    console.log(`\n🎉 Deployment completed successfully!`);
    console.log(`📋 Summary:`);
    console.log(`   Network: ${networkName}`);
    console.log(`   DEX Contract: ${dexAddress}`);
    if (tokenAddresses.mockUSDT) {
      console.log(`   Mock USDT: ${tokenAddresses.mockUSDT}`);
      console.log(`   Mock USDC: ${tokenAddresses.mockUSDC}`);
      console.log(`   Mock BTC: ${tokenAddresses.mockBTC}`);
    }
    
  } catch (error) {
    console.error('❌ Deployment failed:', error);
    process.exit(1);
  }
}

// Export for programmatic use
export { deployDEXContract, deployMockTokens, DEPLOYMENT_CONFIGS };

// Run deployment if called directly
if (require.main === module) {
  main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}