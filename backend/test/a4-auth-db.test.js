import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID, createHash } from 'node:crypto';

const enabled = process.env.QUEUESMART_DB_TESTS === '1';

test('Member 1: real MySQL authentication, sessions and HTTP persistence',
  { skip: enabled ? false : 'Requires disposable local/CI MySQL and QUEUESMART_DB_TESTS=1.' },
  async (t) => {
    // Never execute write-oriented integration tests against shared Aiven.
    if (!['127.0.0.1', 'localhost', '::1'].includes(process.env.DB_HOST)) {
      throw new Error('Refusing Member 1 write tests against a nonlocal database. Use disposable local/CI MySQL.');
    }
    if (process.env.DB_NAME !== 'queuesmart_db') {
      throw new Error('Set DB_NAME=queuesmart_db on the disposable test instance.');
    }
    const { pool } = await import('../src/db/pool.js');
    const { findUserByEmail, createUserWithProfile, getUserById,
      saveSession, findSession, deleteSession } = await import('../src/repositories/users.repo.js');
    const { createSqlAuth, hashPassword } = await import('../src/modules/authSql.js');
    const { createApp } = await import('../src/app.js');
    const uid = randomUUID().replace(/-/g, '');
    const email = (label) => `${uid}.${label}@example.test`;
    const createdEmails = new Set();
    const own = (mail) => { createdEmails.add(mail); return mail; };

    t.after(async () => {
      try {
        for (const mail of createdEmails) {
          // Cascade removes user_profiles and auth_sessions; no table truncation.
          await pool.execute('DELETE FROM user_credentials WHERE email = ?', [mail]);
        }
      } finally {
        await pool.end();
      }
    });

    await t.test('credentials + profile, canonical email, no plaintext secret', async () => {
      const auth = createSqlAuth({findUserByEmail, createUserWithProfile, getUserById,
        saveSession, findSession, deleteSession});
      const mail = own(email('registration'));
      const user = await auth.register({name:'  Test Name ', email: mail.toUpperCase(), password:'Password123'});
      assert.deepEqual(user, { id: user.id, name:'Test Name', email:mail, role:'user' });
      const dbUser = await findUserByEmail(mail);
      assert.equal(dbUser.salt.length, 32);
      assert.equal(dbUser.digest.length, 128);
      assert.notEqual(dbUser.digest, 'Password123');
      assert.equal((await getUserById(user.id)).name, 'Test Name');
      assert.equal(JSON.stringify(user).includes('digest'), false);
      await assert.rejects(() => auth.register({name:'Other', email:mail, password:'Password123'}),
        {status:409, code:'EMAIL_EXISTS'});
    });

    await t.test('two simultaneous registrations race safely on UNIQUE(email)', async () => {
      const auth = createSqlAuth({findUserByEmail, createUserWithProfile, getUserById,
        saveSession, findSession, deleteSession});
      const mail=own(email('race'));
      const input={name:'Parallel',email:mail,password:'Password123'};
      const results=await Promise.allSettled([auth.register(input), auth.register(input)]);
      assert.equal(results.filter(x=>x.status==='fulfilled').length,1);
      assert.equal(results.filter(x=>x.status==='rejected' && x.reason.code==='EMAIL_EXISTS').length,1);
      const [rows]=await pool.execute('SELECT COUNT(*) AS n FROM user_credentials WHERE email = ?', [mail]);
      assert.equal(Number(rows[0].n),1);
    });

    await t.test('failed profile insert rolls back credential insert', async () => {
      const mail=own(email('rollback'));
      const {salt,digest}=await hashPassword('Password123');
      await assert.rejects(() => createUserWithProfile({
        name: 'X'.repeat(150), email:mail, salt,digest,role:'user',
      }));
      const [rows]=await pool.execute('SELECT COUNT(*) AS n FROM user_credentials WHERE email = ?', [mail]);
      assert.equal(Number(rows[0].n),0);
    });

    await t.test('hashed session survives auth instance restart and expires exactly', async () => {
      let clock=Date.now();
      const repo={findUserByEmail,createUserWithProfile,getUserById,saveSession,findSession,deleteSession};
      const auth=createSqlAuth(repo,{now:()=>clock,ttl:5000});
      const mail=own(email('session'));
      await auth.register({name:'Session Test',email:mail,password:'Password123'});
      await assert.rejects(() => auth.login({email:mail,password:'WrongPassword'}), {status:401});
      await assert.rejects(() => auth.login({email:mail,password:'Password123',expectedRole:'admin'}), {status:401});
      const login=await auth.login({email:mail,password:'Password123',expectedRole:'user'});
      const hash=createHash('sha256').update(login.token).digest('hex');
      const [rows]=await pool.execute('SELECT token_hash FROM auth_sessions WHERE token_hash = ?', [hash]);
      assert.equal(rows.length,1);
      assert.notEqual(rows[0].token_hash,login.token);
      const fresh=createSqlAuth(repo,{now:()=>clock,ttl:5000});
      assert.equal((await fresh.authenticate(login.token)).email,mail);
      clock+=4999;
      assert.equal((await fresh.authenticate(login.token)).email,mail);
      clock+=1;
      await assert.rejects(() => fresh.authenticate(login.token), {status:401,code:'UNAUTHENTICATED'});
      assert.equal(await findSession(hash),null);
      const next=await auth.login({email:mail,password:'Password123'});
      await fresh.logout(next.token);
      await assert.rejects(() => auth.authenticate(next.token), {status:401});
    });

    await t.test('SQL-auth HTTP register/login/me/logout survives new Express instance', async () => {
      const mail=own(email('http'));
      const launch=async () => {
        const {app}=createApp({authStorage:'mysql'});
        const server=app.listen(0,'127.0.0.1');
        await new Promise(resolve=>server.once('listening',resolve));
        return {server,base:`http://127.0.0.1:${server.address().port}/api`};
      };
      const stop=(server)=>new Promise(resolve=>server.close(resolve));
      const call=async (base,route,method='GET',body,token)=>{
        const response=await fetch(base+route,{method,headers:{
          ...(body===undefined?{}:{'Content-Type':'application/json'}),
          ...(token?{Authorization:`Bearer ${token}`}:{})},
          ...(body===undefined?{}:{body:JSON.stringify(body)})});
        return {status:response.status,...await response.json()};
      };
      const first=await launch();
      let token;
      try {
        const health=await call(first.base,'/health');
        assert.equal(health.data.storage,'in-memory');
        assert.equal(health.data.authStorage,'mysql');
        const reg=await call(first.base,'/auth/register','POST',{
          name:'HTTP Test',email:mail,password:'Password123',
        });
        assert.equal(reg.status,201);
        assert.deepEqual(reg.data,{id:reg.data.id,name:'HTTP Test',email:mail,role:'user'});
        const login=await call(first.base,'/auth/login','POST',{
          email:mail,password:'Password123',expectedRole:'user',
        });
        assert.equal(login.status,200);
        token=login.data.token;
        assert.equal((await call(first.base,'/auth/me','GET',undefined,token)).data.email,mail);
        assert.equal((await call(first.base,'/services','POST',{
          name:'forbidden',description:'no',expectedDuration:1,priority:'low',
        },token)).status,403);
      } finally { await stop(first.server); }
      const second=await launch();
      try {
        assert.equal((await call(second.base,'/auth/me','GET',undefined,token)).data.email,mail);
        assert.equal((await call(second.base,'/auth/logout','POST',{},token)).status,200);
        assert.equal((await call(second.base,'/auth/me','GET',undefined,token)).status,401);
      } finally { await stop(second.server); }
    });

    await t.test('administrator login requires DB-assigned role; public register cannot self-elevate', async () => {
      const mail=own(email('admin'));
      const {salt,digest}=await hashPassword('StrongAdminPassword1');
      const admin=await createUserWithProfile({name:'Bootstrap Test',email:mail,salt,digest,role:'admin'});
      assert.equal(admin.role,'admin');
      const auth=createSqlAuth({findUserByEmail,createUserWithProfile,getUserById,saveSession,findSession,deleteSession});
      const login=await auth.login({email:mail,password:'StrongAdminPassword1',expectedRole:'admin'});
      assert.equal(login.user.role,'admin');
      await assert.rejects(()=>auth.register({name:'Bad',email:email('bad'),password:'Password123',role:'admin'}),{status:400});
      await auth.logout(login.token);
    });
  },
);
