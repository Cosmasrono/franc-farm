// Sample pharmacy products for trying the shop and the till.
//
//   pnpm mock:products          add the samples (skips names that already exist)
//   pnpm mock:products:clean    remove the samples again (run mock:pos:clean first)
//   pnpm mock:products:reset    remove, then add fresh
//   pnpm mock:products:photos   give existing samples their photos
//
// Samples are tagged with the SKU prefix SAMPLE- so cleaning never touches real products.
// Prices and stock are made up. Check every product before selling it for real.
import { PrismaClient } from '@prisma/client';
import credits from '../app/lib/photo-credits.json';

const prisma = new PrismaClient();
const TAG = 'SAMPLE-';
const months = (n: number) => { const d = new Date(); d.setMonth(d.getMonth() + n); d.setHours(23, 59, 59, 999); return d; };

const samples = [
  { name: 'Panadol Extra', genericName: 'Paracetamol + Caffeine', category: 'Pain & fever', strength: '500 mg/65 mg', dosageForm: 'Tablet', packSize: 'Pack of 20 tablets', price: 250, costPrice: 180, stock: 60, expiry: 20 },
  { name: 'Paracetamol 500mg', genericName: 'Paracetamol', category: 'Pain & fever', strength: '500 mg', dosageForm: 'Tablet', packSize: 'Strip of 10 tablets', price: 50, costPrice: 25, stock: 200, expiry: 24 },
  { name: 'Ibuprofen 400mg', genericName: 'Ibuprofen', category: 'Pain & fever', strength: '400 mg', dosageForm: 'Tablet', packSize: 'Pack of 24 tablets', price: 180, costPrice: 110, stock: 8, expiry: 18 },
  { name: 'Calpol Paediatric Suspension', genericName: 'Paracetamol', category: 'Mother & baby', strength: '120 mg/5 ml', dosageForm: 'Suspension', packSize: '100 ml bottle', price: 450, costPrice: 320, stock: 25, expiry: 2 },
  { name: 'Benylin Dry Cough Syrup', genericName: 'Dextromethorphan', category: 'Cough, cold & flu', strength: '7.5 mg/5 ml', dosageForm: 'Syrup', packSize: '100 ml bottle', price: 620, costPrice: 440, stock: 18, expiry: 14 },
  { name: 'Strepsils Honey & Lemon', genericName: 'Amylmetacresol + Dichlorobenzyl alcohol', category: 'Cough, cold & flu', dosageForm: 'Other', packSize: '24 lozenges', price: 480, costPrice: 330, stock: 30, expiry: 22 },
  { name: 'ORS Sachets', genericName: 'Oral rehydration salts', category: 'Digestive health', dosageForm: 'Sachet', packSize: '10 sachets', price: 150, costPrice: 80, stock: 0, expiry: 30 },
  { name: 'Gaviscon Liquid', genericName: 'Sodium alginate + Sodium bicarbonate', category: 'Digestive health', dosageForm: 'Suspension', packSize: '200 ml bottle', price: 890, costPrice: 650, stock: 12, expiry: 16 },
  { name: 'Vitamin C 1000mg Effervescent', genericName: 'Ascorbic acid', category: 'Vitamins & supplements', strength: '1000 mg', dosageForm: 'Tablet', packSize: 'Tube of 20', price: 750, costPrice: 520, stock: 40, expiry: 12 },
  { name: 'Multivitamin Daily', genericName: 'Multivitamin & minerals', category: 'Vitamins & supplements', dosageForm: 'Tablet', packSize: 'Pack of 30 tablets', price: 1200, costPrice: 850, stock: 15, expiry: 26 },
  { name: 'Elastoplast Fabric Plasters', category: 'First aid', dosageForm: 'Other', packSize: 'Box of 20', price: 380, costPrice: 240, stock: 22, expiry: 48 },
  { name: 'Savlon Antiseptic Liquid', genericName: 'Chlorhexidine + Cetrimide', category: 'First aid', dosageForm: 'Other', packSize: '250 ml bottle', price: 420, costPrice: 300, stock: 14, expiry: 30 },
  { name: 'Aqueous Cream', category: 'Skin care', dosageForm: 'Cream', packSize: '500 g tub', price: 550, costPrice: 380, stock: 9, expiry: 20 },
  { name: 'Hydrocortisone 1% Cream', genericName: 'Hydrocortisone', category: 'Skin care', strength: '1%', dosageForm: 'Cream', packSize: '15 g tube', price: 350, costPrice: 230, stock: 11, expiry: 1 },
  { name: 'Colgate Total Toothpaste', category: 'Personal care', dosageForm: 'Other', packSize: '100 ml tube', price: 320, costPrice: 230, stock: 35, expiry: 30 },
  { name: 'Digital Thermometer', category: 'Medical devices', dosageForm: 'Device', packSize: '1 unit', price: 650, costPrice: 400, stock: 6 },
  { name: 'Automatic BP Monitor', category: 'Medical devices', dosageForm: 'Device', packSize: '1 unit', price: 4500, costPrice: 3200, stock: 3 },
  { name: 'Amoxicillin 500mg', genericName: 'Amoxicillin', category: 'Prescription medicines', strength: '500 mg', dosageForm: 'Capsule', packSize: 'Pack of 21 capsules', price: 450, costPrice: 280, stock: 50, expiry: 15 },
  { name: 'Metformin 500mg', genericName: 'Metformin', category: 'Prescription medicines', strength: '500 mg', dosageForm: 'Tablet', packSize: 'Pack of 28 tablets', price: 300, costPrice: 170, stock: 40, expiry: 19 },
  { name: 'Amlodipine 5mg', genericName: 'Amlodipine', category: 'Prescription medicines', strength: '5 mg', dosageForm: 'Tablet', packSize: 'Pack of 28 tablets', price: 380, costPrice: 220, stock: 4, expiry: 9 },
  { name: 'Augmentin 625mg', genericName: 'Amoxicillin + Clavulanic acid', category: 'Prescription medicines', strength: '500 mg/125 mg', dosageForm: 'Tablet', packSize: 'Pack of 14 tablets', price: 1450, costPrice: 1050, stock: 20, expiry: 13 },
  { name: 'Ciprofloxacin 500mg', genericName: 'Ciprofloxacin', category: 'Prescription medicines', strength: '500 mg', dosageForm: 'Tablet', packSize: 'Pack of 10 tablets', price: 350, costPrice: 200, stock: 30, expiry: 17 },
  { name: 'Losartan 50mg', genericName: 'Losartan potassium', category: 'Prescription medicines', strength: '50 mg', dosageForm: 'Tablet', packSize: 'Pack of 28 tablets', price: 650, costPrice: 420, stock: 25, expiry: 21 },
  { name: 'Salbutamol Inhaler', genericName: 'Salbutamol', category: 'Prescription medicines', strength: '100 mcg/dose', dosageForm: 'Inhaler', packSize: '200 doses', price: 750, costPrice: 520, stock: 12, expiry: 11 },
  { name: 'Artemether/Lumefantrine (Coartem)', genericName: 'Artemether + Lumefantrine', category: 'Prescription medicines', strength: '20 mg/120 mg', dosageForm: 'Tablet', packSize: 'Pack of 24 tablets', price: 520, costPrice: 340, stock: 35, expiry: 16 },
  { name: 'Omeprazole 20mg', genericName: 'Omeprazole', category: 'Prescription medicines', strength: '20 mg', dosageForm: 'Capsule', packSize: 'Pack of 28 capsules', price: 400, costPrice: 230, stock: 28, expiry: 14 },
  { name: 'Diclofenac Gel 1%', genericName: 'Diclofenac sodium', category: 'Pain & fever', strength: '1%', dosageForm: 'Gel', packSize: '30 g tube', price: 380, costPrice: 240, stock: 26, expiry: 19 },
  { name: 'Hedex', genericName: 'Paracetamol', category: 'Pain & fever', strength: '500 mg', dosageForm: 'Tablet', packSize: 'Strip of 8 tablets', price: 60, costPrice: 35, stock: 150, expiry: 23 },
  { name: 'Mara Moja', genericName: 'Aspirin + Paracetamol + Caffeine', category: 'Pain & fever', dosageForm: 'Tablet', packSize: 'Strip of 4 tablets', price: 30, costPrice: 18, stock: 120, expiry: 21 },
  { name: 'Coldcap Daytime', genericName: 'Paracetamol + Phenylephrine', category: 'Cough, cold & flu', dosageForm: 'Capsule', packSize: 'Pack of 12 capsules', price: 220, costPrice: 140, stock: 40, expiry: 18 },
  { name: 'Otrivin Nasal Spray', genericName: 'Xylometazoline', category: 'Cough, cold & flu', strength: '0.1%', dosageForm: 'Spray', packSize: '10 ml', price: 560, costPrice: 390, stock: 15, expiry: 20 },
  { name: 'Cetirizine 10mg', genericName: 'Cetirizine', category: 'Cough, cold & flu', strength: '10 mg', dosageForm: 'Tablet', packSize: 'Pack of 10 tablets', price: 120, costPrice: 60, stock: 70, expiry: 25 },
  { name: 'Loperamide 2mg', genericName: 'Loperamide', category: 'Digestive health', strength: '2 mg', dosageForm: 'Capsule', packSize: 'Pack of 6 capsules', price: 150, costPrice: 85, stock: 24, expiry: 22 },
  { name: 'Eno Fruit Salt', genericName: 'Sodium bicarbonate + Citric acid', category: 'Digestive health', dosageForm: 'Sachet', packSize: '6 sachets', price: 180, costPrice: 120, stock: 33, expiry: 28 },
  { name: 'Zinc Sulphate 20mg (children)', genericName: 'Zinc', category: 'Digestive health', strength: '20 mg', dosageForm: 'Tablet', packSize: 'Pack of 10 dispersible tablets', price: 140, costPrice: 80, stock: 19, expiry: 17 },
  { name: 'Folic Acid 5mg', genericName: 'Folic acid', category: 'Vitamins & supplements', strength: '5 mg', dosageForm: 'Tablet', packSize: 'Pack of 30 tablets', price: 150, costPrice: 70, stock: 45, expiry: 24 },
  { name: 'Omega-3 Fish Oil', genericName: 'Omega-3 fatty acids', category: 'Vitamins & supplements', strength: '1000 mg', dosageForm: 'Capsule', packSize: 'Bottle of 60 capsules', price: 1650, costPrice: 1150, stock: 10, expiry: 15 },
  { name: 'Ferrous Sulphate 200mg', genericName: 'Iron', category: 'Vitamins & supplements', strength: '200 mg', dosageForm: 'Tablet', packSize: 'Pack of 28 tablets', price: 160, costPrice: 90, stock: 30, expiry: 20 },
  { name: 'Crepe Bandage 10cm', category: 'First aid', dosageForm: 'Other', packSize: '1 roll', price: 180, costPrice: 110, stock: 25 },
  { name: 'Cotton Wool 100g', category: 'First aid', dosageForm: 'Other', packSize: '100 g roll', price: 150, costPrice: 90, stock: 40 },
  { name: 'Povidone-Iodine 10% Solution', genericName: 'Povidone-iodine', category: 'First aid', strength: '10%', dosageForm: 'Other', packSize: '100 ml bottle', price: 320, costPrice: 210, stock: 7, expiry: 26 },
  { name: 'Sunscreen SPF 50', category: 'Skin care', dosageForm: 'Cream', packSize: '50 ml tube', price: 1350, costPrice: 950, stock: 8, expiry: 18 },
  { name: 'Clotrimazole 1% Cream', genericName: 'Clotrimazole', category: 'Skin care', strength: '1%', dosageForm: 'Cream', packSize: '20 g tube', price: 220, costPrice: 130, stock: 21, expiry: 22 },
  { name: 'Petroleum Jelly', category: 'Skin care', dosageForm: 'Ointment', packSize: '250 ml jar', price: 250, costPrice: 170, stock: 30, expiry: 36 },
  { name: 'Baby Diapers Size 3', category: 'Mother & baby', dosageForm: 'Other', packSize: 'Pack of 40', price: 1450, costPrice: 1100, stock: 16 },
  { name: 'Gripe Water', category: 'Mother & baby', dosageForm: 'Syrup', packSize: '150 ml bottle', price: 380, costPrice: 260, stock: 14, expiry: 12 },
  { name: 'Prenatal Vitamins', genericName: 'Multivitamin with folic acid & iron', category: 'Mother & baby', dosageForm: 'Tablet', packSize: 'Pack of 30 tablets', price: 950, costPrice: 650, stock: 12, expiry: 19 },
  { name: 'Hand Sanitiser 500ml', genericName: 'Ethanol 70%', category: 'Personal care', dosageForm: 'Gel', packSize: '500 ml bottle', price: 450, costPrice: 290, stock: 25, expiry: 24 },
  { name: 'Sanitary Pads (Always)', category: 'Personal care', dosageForm: 'Other', packSize: 'Pack of 8', price: 120, costPrice: 85, stock: 60 },
  { name: 'Male Condoms', category: 'Personal care', dosageForm: 'Other', packSize: 'Pack of 3', price: 150, costPrice: 90, stock: 50, expiry: 36 },
  { name: 'Glucometer Starter Kit', category: 'Medical devices', dosageForm: 'Device', packSize: 'Meter + 10 strips', price: 2800, costPrice: 1950, stock: 5 },
  { name: 'Glucose Test Strips', category: 'Medical devices', dosageForm: 'Device', packSize: 'Box of 50 strips', price: 1900, costPrice: 1350, stock: 9, expiry: 10 },
  { name: 'Pulse Oximeter', category: 'Medical devices', dosageForm: 'Device', packSize: '1 unit', price: 2200, costPrice: 1500, stock: 4 },
  { name: 'Face Masks (3-ply)', category: 'Medical devices', dosageForm: 'Other', packSize: 'Box of 50', price: 400, costPrice: 220, stock: 2 },
];

async function clean() {
  const ids = (await prisma.product.findMany({ where: { sku: { startsWith: TAG } }, select: { id: true } })).map((p) => p.id);
  await prisma.stockMovement.deleteMany({ where: { productId: { in: ids } } });
  await prisma.cart.deleteMany({ where: { productId: { in: ids } } });
  const removed = await prisma.product.deleteMany({ where: { sku: { startsWith: TAG } } });
  console.log(`Removed ${removed.count} sample products.`);
}

async function add() {
  let added = 0;
  for (const [i, s] of samples.entries()) {
    if (await prisma.product.findFirst({ where: { name: s.name } })) continue;
    const { expiry, ...fields } = s;
    const product = await prisma.product.create({
      data: {
        ...fields,
        sku: `${TAG}${String(i + 1).padStart(3, '0')}`,
        batchNumber: `B${new Date().getFullYear()}-${String(i + 1).padStart(3, '0')}`,
        expiryDate: expiry ? months(expiry) : null,
        requiresPrescription: s.category === 'Prescription medicines',
        // Openly licensed photo where one was found (see /credits); otherwise the shop draws an illustration.
        image: (credits as Record<string, { image: string }>)[s.name]?.image ?? null,
        reorderLevel: 10,
      },
    });
    if (product.stock > 0) {
      await prisma.stockMovement.create({ data: { productId: product.id, productName: product.name, change: product.stock, stockAfter: product.stock, reason: 'RESTOCK', note: 'Sample opening stock', userName: 'Sample data' } });
    }
    added++;
  }
  console.log(`Added ${added} sample products.`);
}

/** Gives existing sample products the photos listed in photo-credits.json. */
async function photos() {
  let n = 0;
  for (const [name, c] of Object.entries(credits as Record<string, { image: string }>)) {
    n += (await prisma.product.updateMany({ where: { name, sku: { startsWith: TAG } }, data: { image: c.image } })).count;
  }
  console.log(`Set photos on ${n} sample products.`);
}

async function main() {
  const args = process.argv.slice(2);
  if (args.includes('--photos')) return photos();
  if (args.includes('--clean') || args.includes('--reset')) await clean();
  if (!args.includes('--clean')) await add();
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
