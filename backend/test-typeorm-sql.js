const { DataSource } = require("typeorm");

const ds = new DataSource({
  type: "mysql",
  database: "test",
  entities: [
    class QuotationEntity {
      constructor() {}
    }
  ]
});

async function run() {
  const qb = ds.createQueryBuilder().update("quotation").set({ parentQuotationId: 123 }).where([{ quotationId: 1 }, { parentQuotationId: 1 }]);
  console.log("SQL:", qb.getSql());
}
run();
