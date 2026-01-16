require("dotenv").config();
const { GOOGLE_API_KEY } = process.env;
const { PrismaClient } = require("@prisma/client");
const axios = require("axios");
const { SocksProxyAgent } = require("socks-proxy-agent");

const prisma = new PrismaClient();

// CONFIGURATION
const PROXY_URL = "socks5h://127.0.0.1:8080"; // 'h' resolves DNS via proxy

// Create Axios Instance with Proxy and Base Headers
const vpsAxios = axios.create({
  httpsAgent: new SocksProxyAgent(PROXY_URL),
  proxy: false,
  headers: {
    "Content-Type": "application/json",
    "X-Goog-Api-Key": GOOGLE_API_KEY,
  },
});

async function runStudy() {
  try {
    console.log("--- Starting Financial Institution Study ---");

    // 1. Get Bottom 10 (Worst)
    const worstBanks = await prisma.institutions.findMany({
      where: { review_count: { gt: 100 } },
      orderBy: { review_rating: "asc" },
      take: 10,
    });

    // 2. Get Top 10 (Best)
    const bestBanks = await prisma.institutions.findMany({
      where: { review_count: { gt: 100 } },
      orderBy: { review_rating: "desc" },
      take: 10,
    });

    const targetList = [...worstBanks, ...bestBanks];
    console.log(`Found ${targetList.length} institutions to analyze.`);

    for (const bank of targetList) {
      console.log(
        `\nProcessing: ${bank.title} (${bank.city}, ${bank.state}) - Rating: ${bank.review_rating}`,
      );

      // STEP A: Search for the Place ID using Title + Location
      const searchQuery = `${bank.title} ${bank.city || ""} ${bank.state || ""}`;
      const placeId = await getPlaceId(searchQuery);

      if (!placeId) {
        console.log(`Could not find Place ID for ${bank.title}`);
        continue;
      }

      // STEP B: Get Reviews for that Place ID
      const reviews = await getPlaceReviews(placeId);

      if (reviews.length === 0) {
        console.log(`No reviews found for ${bank.title}`);
        continue;
      }

      // STEP C: Save to Database
      let savedCount = 0;
      for (const rev of reviews) {
        try {
          await prisma.reviews.upsert({
            where: { id: rev.name },
            update: {}, // Don't overwrite if it exists
            create: {
              id: rev.name,
              institution_id: bank.id,
              rating: rev.rating,
              text: rev.text?.text || "",
              language: rev.languageCode,
              author_name: rev.authorAttribution?.displayName || "Anonymous",
              author_photo_url: rev.authorAttribution?.photoUri,
              relative_time: rev.relativePublishTimeDescription,
              publish_time: new Date(rev.publishTime),
            },
          });
          savedCount++;
        } catch (dbErr) {
          console.error(`Error saving review ${rev.name}:`, dbErr.message);
        }
      }
      console.log(`Successfully saved ${savedCount} reviews.`);
    }
  } catch (error) {
    console.error("Critical script error:", error.message);
  } finally {
    await prisma.$disconnect();
  }
}

/**
 * Uses Google Places (New) Text Search to find Place ID
 */
async function getPlaceId(query) {
  try {
    const res = await vpsAxios.post(
      "https://places.googleapis.com/v1/places:searchText",
      { textQuery: query },
      {
        headers: { "X-Goog-FieldMask": "places.id,places.displayName" },
      },
    );

    return res.data.places?.[0]?.id || null;
  } catch (err) {
    console.error(
      `Search Error (403 usually means API not enabled or Key restricted):`,
      err.response?.data || err.message,
    );
    return null;
  }
}

/**
 * Uses Google Places (New) Details to get Reviews
 * Note: Returns the 5 most "relevant" reviews per Google's API limit
 */
async function getPlaceReviews(placeId) {
  try {
    const res = await vpsAxios.get(
      `https://places.googleapis.com/v1/places/${placeId}`,
      {
        headers: { "X-Goog-FieldMask": "reviews,displayName" },
      },
    );

    return res.data.reviews || [];
  } catch (err) {
    console.error(
      `Details Error for ${placeId}:`,
      err.response?.data || err.message,
    );
    return [];
  }
}

runStudy();
