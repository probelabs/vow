#!/usr/bin/env node
'use strict';

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('🚀 Starting deployment process...\n');

// Step 1: Deploy to Pages
console.log('📦 Deploying site to Cloudflare Pages...');
try {
  const pagesOutput = execSync('cd site && npx wrangler pages deploy . --project-name=vow-site --commit-dirty=true', {
    encoding: 'utf8',
    stdio: 'pipe'
  });
  
  console.log(pagesOutput);
  
  // Extract the deployment URL from the output
  const urlMatch = pagesOutput.match(/https:\/\/([a-z0-9]+)\.vow-site\.pages\.dev/);
  
  if (!urlMatch) {
    console.error('❌ Could not extract deployment URL from Pages output');
    process.exit(1);
  }
  
  const deploymentId = urlMatch[1];
  const fullUrl = urlMatch[0];
  
  console.log(`✅ Pages deployed to: ${fullUrl}\n`);
  
  // Step 2: Update worker.js with new deployment URL
  console.log('📝 Updating worker.js with new deployment URL...');
  
  const workerPath = path.join(__dirname, '..', 'worker.js');
  let workerContent = fs.readFileSync(workerPath, 'utf8');
  
  // Replace the old Pages URL with the new one
  const oldUrlPattern = /https:\/\/[a-z0-9]+\.vow-site\.pages\.dev/g;
  workerContent = workerContent.replace(oldUrlPattern, fullUrl);
  
  fs.writeFileSync(workerPath, workerContent);
  console.log(`✅ Updated worker.js to use ${fullUrl}\n`);
  
  // Step 3: Deploy the updated worker
  console.log('☁️  Deploying updated worker to Cloudflare...');
  
  try {
    const workerOutput = execSync('npx wrangler deploy', {
      encoding: 'utf8',
      stdio: 'pipe'
    });
    
    console.log(workerOutput);
    console.log('✅ Worker deployed successfully!\n');
  } catch (workerError) {
    console.error('❌ Failed to deploy worker:', workerError.message);
    process.exit(1);
  }
  
  console.log('🎉 Deployment complete!');
  console.log(`   Site: ${fullUrl}`);
  console.log(`   Live: https://probelabs.com/vow/`);
  
} catch (error) {
  console.error('❌ Deployment failed:', error.message);
  process.exit(1);
}