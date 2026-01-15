// banks.js

const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function run() {
  // Loop through records in chunks of 100
  for (let i = 0; i < 4350; i += 25) {
    console.log(`Fetching records starting at ${i}...`);

    try {
      const response = await fetch(
        `https://pfabankapi.app.cloud.gov/api/institutions?agg_by=&filters=%28ACTIVE%3A%220%22%20OR%20ACTIVE%3A%221%22%29&limit=25&offset=${i}&react=true&search=&sort_by=NAME&sort_order=ASC`,
        {
          headers: {
            accept: "*/*",
            "accept-language":
              "en-PH,en-US;q=0.9,en;q=0.8,zh-CN;q=0.7,zh;q=0.6",
            priority: "u=1, i",
            "sec-ch-ua":
              '"Google Chrome";v="143", "Chromium";v="143", "Not A(Brand";v="24"',
            "sec-ch-ua-mobile": "?0",
            "sec-ch-ua-platform": '"Windows"',
            "sec-fetch-dest": "empty",
            "sec-fetch-mode": "cors",
            "sec-fetch-site": "cross-site",
            "x-rate-limit": "off",
          },
          referrer: "https://banks.data.fdic.gov/",
          body: null,
          method: "GET",
          mode: "cors",
          credentials: "omit",
        },
      );

      const data = await response.json();


      for (let row of data.data) {


        let record = ??? // upsert data
        console.log(record.id);
      }

      console.log(`Processed ${data.results.length} rows.`);
    } catch (error) {
      console.error(`Error at skip ${i}:`, error);
    }
  }
}

run()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
