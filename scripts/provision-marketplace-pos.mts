import '../apps/api/node_modules/reflect-metadata/Reflect.js';
import { config } from '../apps/api/node_modules/dotenv/lib/main.js';
import { fileURLToPath } from 'node:url';
import { randomBytes, createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { PrismaClient, createPostgresAdapter } from '../packages/database/src/index.js';
import { PosEmployeeService } from '../apps/api/src/modules/auth/pos-employee.service.js';
import type { PrismaService } from '../apps/api/src/infrastructure/database/prisma.service.js';
config({ path: fileURLToPath(new URL('../.env', import.meta.url)), quiet: true });
if (!process.env.DATABASE_URL || !process.env.LOCALAPPDATA) throw new Error('Local configuration is required.');
if (process.env.NODE_ENV === 'production' || !['localhost','127.0.0.1','[::1]'].includes(new URL(process.env.DATABASE_URL).hostname)) throw new Error('Local database only.');
const apply = process.argv.includes('--apply');
const actor = 'marketplace-pos-20261113';
const directory = join(process.env.LOCALAPPDATA, 'Waffarly', 'local-pos-credentials');
const client = new PrismaClient({ adapter: createPostgresAdapter(process.env.DATABASE_URL) });
function protect(value: string, decrypt = false): string {
  const command = decrypt
    ? 'Add-Type -AssemblyName System.Security; $v = [Console]::In.ReadToEnd(); [Text.Encoding]::UTF8.GetString([Security.Cryptography.ProtectedData]::Unprotect([Convert]::FromBase64String($v), $null, [Security.Cryptography.DataProtectionScope]::CurrentUser))'
    : 'Add-Type -AssemblyName System.Security; $v = [Console]::In.ReadToEnd(); [Convert]::ToBase64String([Security.Cryptography.ProtectedData]::Protect([Text.Encoding]::UTF8.GetBytes($v), $null, [Security.Cryptography.DataProtectionScope]::CurrentUser))';
  return execFileSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', command], { input: value, encoding: 'utf8', windowsHide: true }).trim();
}
try {
  const service = new PosEmployeeService(client as unknown as PrismaService);
  const merchants = await client.merchant.findMany({
    where: { storefrontSlug: { in: Array.from({length:12}, (_,i) => 'reference-restaurant-'+(i+1)) } },
    select: { id:true, storefrontSlug:true, branches:{where:{archivedAt:null},select:{id:true}} },
  });
  if (merchants.length !== 12) throw new Error('Expected twelve restaurants.');
  for (const merchant of merchants) {
    const index = Number(merchant.storefrontSlug.replace('reference-restaurant-', ''))-1;
    const h = createHash('sha256').update('waffarly-reference-v1:merchant:'+index).digest('hex');
    const expected = h.slice(0,8)+'-'+h.slice(8,12)+'-4'+h.slice(13,16)+'-a'+h.slice(17,20)+'-'+h.slice(20,32);
    if (merchant.id !== expected || merchant.branches.length !== 1) throw new Error('Tenant identity or branch readiness mismatch.');
  }
  if (apply) await mkdir(directory, {recursive:true});
  for (const merchant of merchants) {
    const branchId = merchant.branches[0]!.id;
    const username = 'waffarly-cashier';
    const existing = await client.posEmployee.findFirst({where:{merchantId:merchant.id,username},select:{id:true,createdBy:true,active:true,branches:{select:{branchId:true}}}});
    if (existing) {
      if (existing.createdBy !== actor || !existing.active || existing.branches.length !== 1 || existing.branches[0]!.branchId !== branchId) throw new Error('Existing account requires owner review.');
      console.log(JSON.stringify({slug:merchant.storefrontSlug,username,status:'existing',branchScoped:true}));
      continue;
    }
    if (!apply) { console.log(JSON.stringify({slug:merchant.storefrontSlug,status:'ready-to-create'})); continue; }
    const path = join(directory,merchant.storefrontSlug+'.json');
    let record: {slug:string;username:string;merchantId:string;branchId:string;encryptedPassword:string};
    try { record = JSON.parse(await readFile(path,'utf8')); }
    catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
      record = {slug:merchant.storefrontSlug,username,merchantId:merchant.id,branchId,encryptedPassword:protect(randomBytes(24).toString('base64url'))};
      await writeFile(path, JSON.stringify(record,null,2), {flag:'wx'});
    }
    if (record.merchantId !== merchant.id || record.branchId !== branchId || record.username !== username) throw new Error('Credential scope mismatch.');
    const employee = await service.create(merchant.id, actor, {username,displayName:'كاشير وفرلي',password:protect(record.encryptedPassword,true),role:'cashier',branchIds:[branchId]});
    if (!['accept_recipe_orders','start_preparation','sell'].every(permission => employee.permissions.includes(permission as never))) throw new Error('Required permissions are unavailable.');
    console.log(JSON.stringify({slug:merchant.storefrontSlug,username,status:'created',branchScoped:true}));
  }
  if (apply) console.log('Encrypted credentials saved under LOCALAPPDATA/Waffarly/local-pos-credentials. Passwords were not logged.');
} catch {
  console.error('POS provisioning did not complete. No credentials printed. Rerun safely to reuse created accounts; unexpected existing accounts require owner review.');
  process.exitCode = 1;
} finally { await client.$disconnect(); }
