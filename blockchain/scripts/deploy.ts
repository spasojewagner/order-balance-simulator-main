import { ethers } from "hardhat";

async function main() {
  console.log("🚀 Deploying SimpleDEX contract...");
  
  // Get deployer account
  const [deployer] = await ethers.getSigners();
  console.log("📝 Deploying with account:", deployer.address);
  
  // Check balance
  const balance = await ethers.provider.getBalance(deployer.address);
  console.log("💰 Account balance:", ethers.formatEther(balance), "ETH");
  
  // Deploy contract
  const SimpleDEX = await ethers.getContractFactory("SimpleDEX");
  const dex = await SimpleDEX.deploy();
  
  // Wait for deployment
  await dex.waitForDeployment();
  
  const address = await dex.getAddress();
  
  console.log("✅ SimpleDEX deployed to:", address);
  console.log("-----------------------------------");
  console.log("⚠️  VAŽNO: Kopiraj ovu adresu u backend .env fajl!");
  console.log("DEX_CONTRACT_ADDRESS=" + address);
  console.log("-----------------------------------");
  
  return address;
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });