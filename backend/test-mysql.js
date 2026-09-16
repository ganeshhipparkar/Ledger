const { DataSource } = require("typeorm");
const typeormConfig = require("./dist/packages/config/typeorm.config.js").typeOrmConfig;

// Modify config to point to JS entities
typeormConfig.entities = [__dirname + "/dist/**/*.entity.js"];

async function run() {
  const ds = new DataSource(typeormConfig);
  await ds.initialize();
  
  try {
    const res = await ds.manager.update("QuotationEntity", [{ quotationId: -1 }, { parentQuotationId: -1 }], { parentQuotationId: -2 });
    console.log("Update with array result:", res);
  } catch (e) {
    console.error("Update with array error:", e.message);
  }
  
  try {
    const qInsert = await ds.manager.insert("QuotationEntity", { addedBy: 1, addedDate: new Date(), versionCode: 'TEST' });
    console.log("Insert insertId:", qInsert.raw?.insertId);
    await ds.manager.delete("QuotationEntity", { quotationId: qInsert.raw?.insertId });
  } catch (e) {
    console.error("Insert error:", e.message);
  }

  await ds.destroy();
}
run();
