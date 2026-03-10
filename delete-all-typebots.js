#!/usr/bin/env node

/**
 * Script to delete all typebots from a Typebot.io workspace using the Typebot REST API
 *
 * Usage:
 * 1. Add your bearer token to the BEARER_TOKEN variable below
 * 2. Update the BASE_URL if needed (defaults to localhost:3000)
 * 3. Run: node delete-all-typebots.js
 */

const BEARER_TOKEN = "8bPZc3XjRZDputOWaIu3Xgqc"; // Replace with your actual bearer token
const BASE_URL = "http://localhost:3000"; // Change if your app runs on different URL
const WORKSPACE_ID = "cmd7wsdk20000w7itj7k0xtc0"; // Replace with your workspace ID

async function fetchWithAuth(url, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: {
      Authorization: `Bearer ${BEARER_TOKEN}`,
      "Content-Type": "application/json",
      ...options.headers,
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      `HTTP ${response.status}: ${response.statusText}\n${errorText}`,
    );
  }

  return response.json();
}

async function getTypebots(workspaceId) {
  console.log(`📋 Fetching typebots from workspace ${workspaceId}...`);
  // Use the proper Typebot REST API endpoint
  const url = `${BASE_URL}/api/v1/typebots?workspaceId=${encodeURIComponent(workspaceId)}`;

  const data = await fetchWithAuth(url);
  const typebots = data.typebots || [];
  console.log(`✅ Found ${typebots.length} typebot(s)`);
  return typebots;
}

async function deleteTypebot(typebotId) {
  console.log(`🗑️  Deleting typebot ${typebotId}...`);
  // Use the proper Typebot REST API endpoint
  await fetchWithAuth(`${BASE_URL}/api/v1/typebots/${typebotId}`, {
    method: "DELETE",
  });
  console.log(`✅ Deleted typebot ${typebotId}`);
}

async function main() {
  try {
    console.log("🚀 Starting typebot deletion process...\n");

    // Validate bearer token
    if (BEARER_TOKEN === "YOUR_BEARER_TOKEN_HERE") {
      console.error("❌ Please set your BEARER_TOKEN in the script");
      process.exit(1);
    }

    // Validate workspace ID
    if (!WORKSPACE_ID || WORKSPACE_ID === "YOUR_WORKSPACE_ID") {
      console.error("❌ Please set your WORKSPACE_ID in the script");
      console.error(
        "   You can find your workspace ID in the URL when you're in the typebot dashboard",
      );
      process.exit(1);
    }

    console.log(`🎯 Using workspace: ${WORKSPACE_ID}\n`);

    // Get all typebots
    const typebots = await getTypebots(WORKSPACE_ID);
    if (typebots.length === 0) {
      console.log("✅ No typebots to delete");
      return;
    }

    // Confirm deletion
    console.log(`\n⚠️  About to delete ${typebots.length} typebot(s):`);
    typebots.forEach((bot) => console.log(`   - ${bot.name} (${bot.id})`));
    console.log("\n❗ This action cannot be undone!");

    // In a real scenario, you might want to add a confirmation prompt here
    // For now, we'll proceed with deletion

    console.log("\n🗑️  Starting deletion...");

    // Delete all typebots
    for (const typebot of typebots) {
      try {
        await deleteTypebot(typebot.id);
        // Small delay to avoid overwhelming the API
        await new Promise((resolve) => setTimeout(resolve, 100));
      } catch (error) {
        console.error(`❌ Failed to delete ${typebot.id}: ${error.message}`);
      }
    }

    console.log(`\n🎉 Deletion process completed!`);
  } catch (error) {
    console.error(`❌ Error: ${error.message}`);
    process.exit(1);
  }
}

// Check if fetch is available (Node.js 18+)
if (typeof fetch === "undefined") {
  console.error(
    "❌ This script requires Node.js 18+ or you need to install 'node-fetch'",
  );
  console.error("   Run: npm install node-fetch");
  console.error(
    "   Then add: const fetch = require('node-fetch'); at the top of this file",
  );
  process.exit(1);
}

main();
