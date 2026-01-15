const fs = require("fs");
const path = require("path");
const csv = require("csv-parser");
const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();
const CSV_FILE_PATH = path.join(__dirname, "../banks.csv"); // Update with your filename
const BATCH_SIZE = 1000;

/**
 * Safely parses JSON strings from CSV.
 * Returns null if the string is empty or invalid.
 */
function parseJson(value) {
  if (!value || value.trim() === "") return null;
  try {
    return JSON.parse(value);
  } catch (e) {
    return null;
  }
}

async function loadCsv() {
  const records = [];
  let processedCount = 0;

  console.log("Starting CSV import...");

  const stream = fs.createReadStream(CSV_FILE_PATH).pipe(csv());

  for await (const row of stream) {
    // 1. Manually map only the fields that exist in your Prisma model
    // 2. Skip 'id', 'created_at', and 'updated_at' from the CSV as requested
    const record = {
      cid: row.cid,
      data_id: row.data_id || null,
      title: row.title,
      categories: parseJson(row.categories),
      website: row.website || null,
      phone: row.phone || null,
      review_rating: row.review_rating ? parseFloat(row.review_rating) : null,
      review_count: row.review_count ? parseInt(row.review_count, 10) : null,
      price_range: row.price_range || null,
      description: row.description || null,
      attributes: parseJson(row.attributes),
      owner_name: row.owner_name || null,
      is_verified:
        row.is_verified?.toLowerCase() === "true" || row.is_verified === "1",
      address: row.address || null,
      city: row.city || null,
      postal_code: row.postal_code || null,
      state: row.state || null,
      country: row.country || null,
      latitude: row.latitude ? parseFloat(row.latitude) : null,
      longitude: row.longitude ? parseFloat(row.longitude) : null,
      // updated_at is required in your model but skipped from CSV, so we set it to now()
      updated_at: new Date(),
    };

    records.push(record);

    // Batch insert when we reach the BATCH_SIZE
    if (records.length >= BATCH_SIZE) {
      await prisma.institutions.createMany({
        data: [...records],
        skipDuplicates: true, // Optional: skips records if 'cid' already exists
      });
      processedCount += records.length;
      console.log(`Inserted ${processedCount} records...`);
      records.length = 0; // Clear the array
    }
  }

  // Insert any remaining records
  if (records.length > 0) {
    await prisma.institutions.createMany({
      data: records,
      skipDuplicates: true,
    });
    processedCount += records.length;
  }

  console.log(`Finished! Total inserted: ${processedCount}`);
}

loadCsv()
  .catch((e) => {
    console.error("Error during import:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
