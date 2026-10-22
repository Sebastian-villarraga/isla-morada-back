import { hash } from 'bcrypt';
import { OperatingDayStatus, PrismaClient, ScheduleStatus, UserRole } from '@prisma/client';
import { defaultScheduleTemplate } from '../src/schedules/schedule-templates';

const prisma = new PrismaClient();

async function main(): Promise<void> {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('El seed de desarrollo está deshabilitado en producción.');
  }

  const users = [
    { name: 'Administrador de desarrollo', email: 'admin@islamorada.local', password: 'DevelopmentAdmin123!', role: UserRole.ADMIN },
    { name: 'Reservas de desarrollo', email: 'reservas@islamorada.local', password: 'DevelopmentReservas123!', role: UserRole.RESERVAS },
    { name: 'Host de desarrollo', email: 'host@islamorada.local', password: 'DevelopmentHost123!', role: UserRole.HOST },
  ];

  for (const user of users) {
    await prisma.user.upsert({
      where: { email: user.email },
      create: {
        name: user.name,
        email: user.email,
        passwordHash: await hash(user.password, 12),
        role: user.role,
      },
      update: {
        name: user.name,
        passwordHash: await hash(user.password, 12),
        role: user.role,
        active: true,
      },
    });
  }

  await prisma.restaurantSettings.upsert({
    where: { id: 'default' },
    create: {
      id: 'default',
      restaurantName: 'Isla Morada',
      reservationToleranceMinutes: 25,
      defaultScheduleCapacity: 200,
      timezone: 'America/Bogota',
    },
    update: {},
  });

  if (await prisma.menuItem.count() === 0) {
    await prisma.menuItem.createMany({ data: [
      { name: 'Croquetas de cangrejo', description: 'Croquetas artesanales con salsa de la casa.', category: 'Entradas', price: 32000, sortOrder: 1 },
      { name: 'Arroz cremoso de mariscos', description: 'SelecciÃ³n de mariscos en arroz cremoso.', category: 'Mar', price: 56000, sortOrder: 2 },
      { name: 'Lomo en salsa de vino', description: 'Lomo de res con acompaÃ±amiento de temporada.', category: 'Fuertes', price: 58000, sortOrder: 3 },
      { name: 'Limonada de coco', description: 'Bebida natural preparada al momento.', category: 'Bebidas', price: 14000, sortOrder: 4 },
      { name: 'Postre de la casa', description: 'PreparaciÃ³n dulce de temporada.', category: 'Postres', price: 18000, sortOrder: 5 },
    ] });
  }

  if (await prisma.menuItem.count({ where: { category: 'Limonadas artesanales' } }) === 0) {
    const image = (name: string) => `http://localhost:3001/uploads/menu/bebidas/${encodeURIComponent(name)}.jpg`;
    await prisma.menuItem.createMany({ data: [
      { name: 'Limonada natural receta de la casa', category: 'Limonadas artesanales', price: 14000, sortOrder: 10, imageUrl: image('Limonadas artesanales') },
      { name: 'Limonada cerezada', category: 'Limonadas artesanales', price: 14500, sortOrder: 11, imageUrl: image('Limonadas artesanales') },
      { name: 'Limonada hierbabuena', category: 'Limonadas artesanales', price: 14500, sortOrder: 12, imageUrl: image('Limonadas artesanales') },
      { name: 'Limonada morada', category: 'Limonadas artesanales', price: 15500, sortOrder: 13, imageUrl: image('Limonadas artesanales') },
      { name: 'Limonada de coco', description: 'Con crema de coco real.', category: 'Limonadas artesanales', price: 22000, sortOrder: 14, imageUrl: image('Limonada de coco') },
      { name: 'Jugos 100% naturales en agua', description: 'Maracuyá, mora, piña o mango.', category: 'Jugos naturales', price: 15400, sortOrder: 20, imageUrl: image('Jugos 100 por ciento naturales') },
      { name: 'Jugos 100% naturales en leche', category: 'Jugos naturales', price: 17000, sortOrder: 21, imageUrl: image('Jugos 100 por ciento naturales') },
      { name: 'Jugos fusión Islamorada en mini jarra', description: 'Mango-maracuyá con hierbabuena.', category: 'Jugos naturales', price: 22000, sortOrder: 22, imageUrl: image('Jugos fusión Islamorada en mini jarra') },
      { name: 'Gaseosa artesanal clásica', category: 'Gaseosas artesanales', price: 27000, sortOrder: 30, imageUrl: image('Gaseosa artesanal clásica') },
      { name: 'Gaseosa artesanal frutos cítricos', category: 'Gaseosas artesanales', price: 27000, sortOrder: 31, imageUrl: image('Gaseosa artesanal frutos cítricos') },
      { name: 'Gaseosa artesanal frutos herbales', category: 'Gaseosas artesanales', price: 27000, sortOrder: 32, imageUrl: image('Gaseosa artesanal frutos herbales') },
      { name: 'Corona Sunrise', description: 'Corona, tequila, limón, mandarina y almíbar de cereza.', category: 'Cervezas', price: 35000, sortOrder: 40, imageUrl: image('Corona Sunrise') },
      { name: 'Jarra de refajo Islamorada', category: 'Jarras', price: 48000, sortOrder: 50, imageUrl: image('Jarra de refajo') },
      { name: 'Piña colada virgen', category: 'Otras bebidas', price: 28000, sortOrder: 60, imageUrl: null },
      { name: 'Canelazo', description: 'Aguardiente Antioqueño, naranja, panela y canela.', category: 'Cócteles', price: 28000, sortOrder: 70, imageUrl: image('Canelazo') },
      { name: 'Islamorada Sunrise', category: 'Cócteles', price: 40000, sortOrder: 71, imageUrl: image('Islamorada Sunrise') },
      { name: 'Bubble', category: 'Cócteles', price: 40000, sortOrder: 72, imageUrl: image('Bubble') },
      { name: 'Mojito', category: 'Cócteles', price: 35000, sortOrder: 73, imageUrl: image('Mojito') },
      { name: 'Piña colada Islamorada', category: 'Cócteles', price: 40000, sortOrder: 74, imageUrl: image('Piña colada Islamorada') },
      { name: 'Gin & Tonic', category: 'Cócteles', price: 40000, sortOrder: 75, imageUrl: image('Gin & Tonic') },
      { name: 'Margarita de fresa', category: 'Cócteles', price: 48000, sortOrder: 76, imageUrl: image('Margarita de fresa') },
      { name: 'Daiquiri de mango', category: 'Cócteles', price: 38000, sortOrder: 77, imageUrl: image('Daiquiri de mango') },
      { name: 'The Choco Brownie Shake', category: 'Milkshakes', price: 30000, sortOrder: 80, imageUrl: image('The Choco Brownie Shake') },
      { name: 'Red Velvet & Berries Milkshake', category: 'Milkshakes', price: 30000, sortOrder: 81, imageUrl: image('Red Velvet & Berries Milkshake') },
      { name: 'Lulada Milkshake', category: 'Milkshakes', price: 30000, sortOrder: 82, imageUrl: image('Lulada Milkshake') },
    ] });
  }

  if (!(await prisma.menuItem.findFirst({ where: { name: 'Papas bravas' } }))) {
    const entryImage = (name: string) => `http://localhost:3001/uploads/menu/entradas/${encodeURIComponent(name)}.jpg`;
    await prisma.menuItem.createMany({ data: [
      { name: 'Papas bravas', description: 'Papitas criollas fritas con salsa dinamita, tocineta y salsa de ajo.', category: 'Entradas', price: 18000, sortOrder: 100, imageUrl: entryImage('Papas bravas') },
      { name: 'Plátano con queso y bocadillo', category: 'Entradas', price: 25000, sortOrder: 101, imageUrl: entryImage('Plátano con queso y bocadillo') },
      { name: 'Arepas con hogao', category: 'Entradas', price: 24400, sortOrder: 102, imageUrl: entryImage('Arepas con hogao') },
      { name: 'Spring rolls mar y tierra', category: 'Entradas', price: 28000, sortOrder: 103, imageUrl: entryImage('Spring rolls mar y tierra') },
      { name: 'Arepas de choclo', category: 'Entradas', price: 28000, sortOrder: 104, imageUrl: entryImage('Arepas de choclo') },
      { name: 'Chorizos artesanales antioqueños', category: 'Entradas', price: 28000, sortOrder: 105, imageUrl: entryImage('Chorizos artesanales antioqueños') },
      { name: 'Empanadas de ropa vieja', category: 'Entradas', price: 38000, sortOrder: 106, imageUrl: entryImage('Empanadas de ropa vieja') },
      { name: 'Canastas de plátano', category: 'Entradas', price: 34000, sortOrder: 107, imageUrl: entryImage('Canastas de plátano') },
      { name: 'Patacones con hogao', category: 'Entradas', price: 35000, sortOrder: 108, imageUrl: entryImage('Patacones con hogao') },
      { name: 'Chicharrones de cerdo crocantes con chimichurri', category: 'Entradas', price: 40000, sortOrder: 109, imageUrl: entryImage('Chicharrones de cerdo crocantes con chimichurri') },
      { name: 'Tostones de chicharrón', category: 'Entradas', price: 40000, sortOrder: 110, imageUrl: entryImage('Tostones de chicharrón') },
      { name: 'Camarones apanados', category: 'Entradas', price: 42800, sortOrder: 111, imageUrl: entryImage('Camarones apanados') },
      { name: 'Cóctel de camarones', category: 'Entradas', price: 45800, sortOrder: 112, imageUrl: entryImage('Cóctel de camarones') },
      { name: 'Coconut Shrimp Roll', category: 'Entradas', price: 48000, sortOrder: 113, imageUrl: entryImage('Coconut Shirmp Roll') },
      { name: 'Ceviche cremoso de camarones', category: 'Entradas', price: 48000, sortOrder: 114, imageUrl: entryImage('Ceviche cremoso de camarones') },
      { name: 'Picada mix de fritos', category: 'Entradas', price: 78400, sortOrder: 115, imageUrl: entryImage('Picada mix de fritos') },
    ] });
  }

  if (!(await prisma.menuItem.findFirst({ where: { name: 'Pollo pasión' } }))) {
    const strongImage = (name: string) => `http://localhost:3001/uploads/menu/fuertes/${encodeURIComponent(name)}.jpg`;
    await prisma.menuItem.createMany({ data: [
      { name: 'Arroz cantonés con vegetales', category: 'Fuertes', price: 34400, sortOrder: 200, imageUrl: strongImage('Arroz cantonés con vegetales') },
      { name: 'Fettuccini en salsa blanca', category: 'Fuertes', price: 24800, sortOrder: 201, imageUrl: strongImage('Fettuccini en salsa blanca') },
      { name: 'Pollo pasión', category: 'Fuertes', price: 52000, sortOrder: 202, imageUrl: strongImage('Pollo pasión') },
      { name: 'Chuleta valluna', category: 'Fuertes', price: 58400, sortOrder: 203, imageUrl: strongImage('Chuleta valluna') },
      { name: 'Pollo parmesano', category: 'Fuertes', price: 68000, sortOrder: 204, imageUrl: strongImage('Pollo parmesano') },
      { name: 'Pollo con champiñones', category: 'Fuertes', price: 68000, sortOrder: 205, imageUrl: strongImage('Pollo con champiñones') },
      { name: 'Pollo parrillado', category: 'Fuertes', price: 68000, sortOrder: 206, imageUrl: strongImage('Pollo parrillado') },
      { name: 'Lomo saltado', category: 'Fuertes', price: 70000, sortOrder: 207, imageUrl: strongImage('Lomo saltado') },
      { name: 'Milanesa de pollo Alfredo', category: 'Fuertes', price: 62400, sortOrder: 208, imageUrl: strongImage('Milanesa de pollo Alfredo') },
      { name: 'Sobrebarriga', category: 'Fuertes', price: 68000, sortOrder: 209, imageUrl: strongImage('Sobrebarriga') },
      { name: 'Posta cartagenera', category: 'Fuertes', price: 72500, sortOrder: 210, imageUrl: strongImage('Posta cartagenera') },
      { name: 'Costillas BBQ', category: 'Fuertes', price: 88000, sortOrder: 211, imageUrl: strongImage('Costillas BBQ') },
      { name: 'Filet mignon', category: 'Parrilla', price: 94500, sortOrder: 220, imageUrl: strongImage('Filet mignon') },
      { name: 'Bife de chorizo', category: 'Parrilla', price: 92000, sortOrder: 221, imageUrl: strongImage('Bife de chorizo') },
      { name: 'Baby beef', category: 'Parrilla', price: 80400, sortOrder: 222, imageUrl: strongImage('Baby beef') },
      { name: 'Rib eye a la parrilla', category: 'Parrilla', price: 92000, sortOrder: 223, imageUrl: strongImage('Rib eye a la parrilla') },
      { name: 'Bowl Nikkei', category: 'Mariscos', price: 58400, sortOrder: 230, imageUrl: strongImage('Bowl Nikkei') },
      { name: 'Pescado frito', category: 'Mariscos', price: 64000, sortOrder: 231, imageUrl: strongImage('Pescado frito') },
      { name: 'Atún Caribe', category: 'Mariscos', price: 64000, sortOrder: 232, imageUrl: strongImage('Atún Caribe') },
      { name: 'Trucha al ajillo', category: 'Mariscos', price: 74000, sortOrder: 233, imageUrl: strongImage('Trucha al ajillo') },
      { name: 'Cazuela de camarones', category: 'Mariscos', price: 75000, sortOrder: 234, imageUrl: strongImage('Cazuela de camarones') },
      { name: 'Salmón teriyaki', category: 'Mariscos', price: 78500, sortOrder: 235, imageUrl: strongImage('Salmón teriyaki') },
      { name: 'Arroz con mariscos', category: 'Mariscos', price: 78400, sortOrder: 236, imageUrl: strongImage('Arroz con mariscos') },
    ] });
  }

  if (!(await prisma.menuItem.findFirst({ where: { name: 'Tenders con mac and cheese' } }))) {
    const otherImage = (name: string) => `http://localhost:3001/uploads/menu/restantes/${encodeURIComponent(name)}.jpg`;
    await prisma.menuItem.createMany({ data: [
      { name: 'Tenders con mac and cheese', category: 'Menú infantil', price: 34000, sortOrder: 300, imageUrl: otherImage('Menú infantil/Tenders con mac and cheese') },
      { name: 'Mac & Cheese', category: 'Menú infantil', price: 24000, sortOrder: 301, imageUrl: null },
      { name: 'Pechuga de pollo marinada al grill', category: 'Menú infantil', price: 34000, sortOrder: 302, imageUrl: null },
      { name: 'Baby beef infantil', category: 'Menú infantil', price: 54000, sortOrder: 303, imageUrl: null },
      { name: 'Chocobrownie', category: 'Postres', price: 17000, sortOrder: 310, imageUrl: otherImage('Postres/Sundae - chocobrownie, frutos amarillos y frutos del bosque') },
      { name: 'Frutos amarillos', category: 'Postres', price: 17000, sortOrder: 311, imageUrl: otherImage('Postres/Sundae - chocobrownie, frutos amarillos y frutos del bosque') },
      { name: 'Frutos del bosque', category: 'Postres', price: 17000, sortOrder: 312, imageUrl: otherImage('Postres/Sundae - chocobrownie, frutos amarillos y frutos del bosque') },
      { name: 'Copa de fresas con crema', category: 'Postres', price: 20000, sortOrder: 313, imageUrl: otherImage('Postres/Copa de fresas con crema') },
      { name: 'Milhoja Islamorada', category: 'Postres', price: 22000, sortOrder: 314, imageUrl: otherImage('Postres/Milhoja Islamorada') },
      { name: 'Fudge brownie', category: 'Postres', price: 22000, sortOrder: 315, imageUrl: otherImage('Postres/Fudge brownie') },
      { name: 'Canollis de la isla', category: 'Postres', price: 25000, sortOrder: 316, imageUrl: otherImage('Postres/Canollis de la isla') },
      { name: 'Torta de chocolate', category: 'Postres', price: 25000, sortOrder: 317, imageUrl: otherImage('Postres/Torta de chocolate') },
      { name: 'Torta red velvet y frutos rojos', category: 'Postres', price: 25000, sortOrder: 318, imageUrl: otherImage('Postres/Torta red velvet y frutos rojos') },
      { name: 'Postre de cumpleaños Islamorada', category: 'Postres', price: 78400, sortOrder: 319, imageUrl: otherImage('Postres/Postre de cumpleaños Islamorada') },
      { name: 'Torta húmeda de chocolate para cumpleaños', category: 'Tortas para cumpleaños', price: 147000, sortOrder: 320, imageUrl: otherImage('Tortas para cumpleaños/Torta húmeda de chocolate para cumpleaños') },
      { name: 'Torta red velvet para cumpleaños', category: 'Tortas para cumpleaños', price: 147000, sortOrder: 321, imageUrl: otherImage('Tortas para cumpleaños/Torta red velvet para cumpleaños') },
    ] });
  }

  // Seed the next two weekends so development availability is never empty
  // just because a previously hard-coded date has passed.
  const today = new Date();
  const nextDays = Array.from({ length: 28 }, (_, offset) => {
    const date = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate() + offset));
    return date.getUTCDay() === 6 || date.getUTCDay() === 0 ? date : null;
  }).filter((date): date is Date => date !== null).slice(0, 4);
  const days = nextDays.map((date, index) => ({
    date,
    prefix: String.fromCharCode(65 + index),
  }));

  for (const item of days) {
    const operatingDay = await prisma.operatingDay.upsert({
      where: { date: item.date },
      create: { date: item.date, prefix: item.prefix, status: OperatingDayStatus.OPEN },
      // Re-running the seed must not alter manually managed dates or their codes.
      update: {},
    });
    for (const startTime of defaultScheduleTemplate(item.date)) {
      await prisma.schedule.upsert({
        where: { operatingDayId_startTime: { operatingDayId: operatingDay.id, startTime } },
        create: { operatingDayId: operatingDay.id, startTime, capacity: 200, status: ScheduleStatus.OPEN },
        update: {},
      });
    }
  }
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => prisma.$disconnect());
