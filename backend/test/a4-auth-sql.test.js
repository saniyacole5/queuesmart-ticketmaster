import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { createSqlAuth } from '../src/modules/authSql.js';

function fakeRepository() {
  let nextId = 1;
  const users = new Map();
  const sessions = new Map();
  return {
    users, sessions,
    async createUserWithProfile({name,email,salt,digest,role}) {
      if (users.has(email)) throw Object.assign(new Error('Duplicate'), {status:409, code:'EMAIL_EXISTS'});
      const user = {id:nextId++,name,email,role,salt,digest};
      users.set(email,user);
      return {id:user.id,name,email,role};
    },
    async findUserByEmail(email) { return users.get(email) ?? null; },
    async saveSession({tokenHash,userId,expiresAt}) { sessions.set(tokenHash,{userId,expiresAt}); },
    async findSession(hash) {
      const entry=sessions.get(hash);
      if (!entry) return null;
      const user=[...users.values()].find(u=>u.id===entry.userId);
      return {userId:entry.userId,expiresAt:entry.expiresAt,user:{id:user.id,name:user.name,email:user.email,role:user.role}};
    },
    async deleteSession(hash) { return sessions.delete(hash); },
  };
}

test('SQL auth: registration is a user and never reveals stored credentials', async () => {
  const repo=fakeRepository();
  const auth=createSqlAuth(repo);
  const registered=await auth.register({name:'  Ada  ',email:' ADA@Example.COM ',password:'Password123'});
  assert.deepEqual(registered,{id:1,name:'Ada',email:'ada@example.com',role:'user'});
  const json=JSON.stringify(registered);
  assert.ok(!/salt|digest|password/i.test(json));
  assert.match(repo.users.get('ada@example.com').digest,/^[0-9a-f]{128}$/);
  await assert.rejects(()=>auth.register({name:'X',email:'x@example.com',password:'Password1',role:'admin'}),{status:400});
  await assert.rejects(()=>auth.register({name:'X',email:'ada@example.com',password:'Password1'}),{status:409,code:'EMAIL_EXISTS'});
});

test('SQL auth: role checks, wrong password, token hash, restart simulation and logout', async () => {
  const repo=fakeRepository();
  let time=Date.parse('2026-11-01T16:00:00.000Z');
  const auth=createSqlAuth(repo,{now:()=>time,ttl:1000});
  await auth.register({name:'Ada',email:'ada@example.com',password:'Password123'});
  for (const body of [
    {email:'ada@example.com',password:'NotMyPassword'},
    {email:'missing@example.com',password:'Password123'},
    {email:'ada@example.com',password:'Password123',expectedRole:'admin'},
  ]) {
    await assert.rejects(()=>auth.login(body),{status:401,code:'INVALID_CREDENTIALS'});
  }
  const {token,user}=await auth.login({email:'ada@example.com',password:'Password123',expectedRole:'user'});
  assert.match(token,/^[a-f0-9]{64}$/);
  assert.deepEqual(user,{id:1,name:'Ada',email:'ada@example.com',role:'user'});
  assert.ok(!repo.sessions.has(token));
  assert.ok(repo.sessions.has(createHash('sha256').update(token).digest('hex')));
  const restarted=createSqlAuth(repo,{now:()=>time,ttl:1000});
  assert.deepEqual(await restarted.authenticate(token),user);
  time+=999;
  assert.deepEqual(await restarted.authenticate(token),user);
  time+=1;
  await assert.rejects(()=>restarted.authenticate(token),{status:401,code:'UNAUTHENTICATED'});
  assert.equal(repo.sessions.size,0);
  const next=await auth.login({email:'ada@example.com',password:'Password123'});
  await restarted.logout(next.token);
  await assert.rejects(()=>auth.authenticate(next.token),{status:401});
  await assert.rejects(()=>auth.authenticate(undefined),{status:401});
});

test('SQL auth: invalid input does not call repository', async () => {
  const repo=fakeRepository();
  const auth=createSqlAuth(repo);
  for(const body of [
    {name:' ',email:'a@example.com',password:'Password123'},
    {name:'A',email:'a@example.com',password:'short'},
    {name:'A',email:'nope',password:'Password123'},
  ]) await assert.rejects(()=>auth.register(body),{status:400});
  assert.equal(repo.users.size,0);
});
