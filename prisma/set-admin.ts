/**
 * Membuat / mereset akun Super Admin dengan password pilihan sendiri (tanpa password default yang publik).
 * Dijalankan manual dari terminal terhadap database yang dituju:
 *
 *   DATABASE_URL="<url>" ADMIN_PASSWORD="<password-baru>" npm run db:set-admin
 *   (opsional) ADMIN_EMAIL="nama@domain.com" ADMIN_NAME="Nama"
 *
 * Password tidak ditulis ke file mana pun; hanya hash bcrypt yang disimpan di database.
 */
import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const email = (process.env.ADMIN_EMAIL ?? "admin@internalbee.local").trim().toLowerCase();
  const name = process.env.ADMIN_NAME ?? "Super Admin";
  const password = process.env.ADMIN_PASSWORD ?? "";
  if (password.length < 8) throw new Error("ADMIN_PASSWORD wajib diisi, minimal 8 karakter.");
  const password_hash = await bcrypt.hash(password, 10);
  const u = await prisma.user.upsert({
    where: { email },
    update: { password_hash, role: "SUPER_ADMIN", is_active: true },
    create: { email, name, role: "SUPER_ADMIN", is_active: true, password_hash },
  });
  console.log(`Super Admin siap: ${u.email} (${u.is_active ? "aktif" : "nonaktif"}). Silakan login dengan password yang baru saja Anda set.`);
  console.log(`Total user di database ini: ${await prisma.user.count()}`);
}

main()
  .catch((e) => {
    console.error(e.message);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
