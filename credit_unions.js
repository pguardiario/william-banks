const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function run() {
  // Loop through records in chunks of 100
  for (let i = 0; i < 23000; i += 100) {
    console.log(`Fetching records starting at ${i}...`);

    try {
      const response = await fetch(
        "https://mapping.ncua.gov/api/ResearchCreditUnion/GetDetailSearch",
        {
          headers: {
            accept: "application/json, text/plain, */*",
            "content-type": "application/json",
          },
          referrer: "https://mapping.ncua.gov/ResearchCreditUnion",
          body: JSON.stringify({
            cuName: null,
            cuType: null,
            cuStatus: null,
            region: null,
            state: null,
            city: null,
            zipCode: null,
            fomType: null,
            lowIncome: null,
            isMdi: null,
            skip: i,
            take: 100,
          }),
          method: "POST",
        },
      );

      const data = await response.json();

      if (!data.results || data.results.length === 0) {
        console.log("No more results found.");
        break;
      }

      for (let row of data.results) {
        // Ensure we have a charter number to search by
        if (!row.charterNumber) continue;

        let record = await prisma.institution.upsert({
          where: {
            charterNumber: row.charterNumber,
          },
          update: {
            name: row.name,
            city: row.city?.trim() || "N/A",
            state: row.state?.trim() || "N/A",
            isCorporate: row.isCorporate,
            isActive: row.isActive,
            type: 'credit union', // Simple string
          },
          create: {
            charterNumber: row.charterNumber,
            name: row.name,
            city: row.city?.trim() || "N/A",
            state: row.state?.trim() || "N/A",
            isCorporate: row.isCorporate,
            isActive: row.isActive,
            type: 'credit union', // Simple string
          },
        });
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
