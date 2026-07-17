export type LocalAccount = {
  id: string;
  identifier: string;
  displayName: string;
  role: 'admin' | 'member';
  createdAt: string;
};

const ACCOUNTS_KEY='aeris-local-accounts';
const SESSION_KEY='aeris-local-session';

function accounts():LocalAccount[]{
  try{
    const value=JSON.parse(localStorage.getItem(ACCOUNTS_KEY)||'[]');
    return Array.isArray(value)?value:[];
  }catch{return[]}
}

export function currentAccount():LocalAccount|undefined{
  const session=localStorage.getItem(SESSION_KEY);
  return accounts().find(account=>account.id===session);
}

export function signInLocal(identifier:string):LocalAccount{
  const clean=identifier.trim().replace(/\s+/g,' ').slice(0,120);
  if(clean.length<2)throw new Error('Enter at least two characters.');
  const existing=accounts();
  let account=existing.find(item=>item.identifier.toLowerCase()===clean.toLowerCase());
  if(!account){
    account={
      id:crypto.randomUUID(),
      identifier:clean,
      displayName:(clean.split('@')[0]||clean).slice(0,36),
      role:existing.length===0?'admin':'member',
      createdAt:new Date().toISOString()
    };
    localStorage.setItem(ACCOUNTS_KEY,JSON.stringify([...existing,account]));
  }
  localStorage.setItem(SESSION_KEY,account.id);
  return account;
}

export function signOutLocal(){localStorage.removeItem(SESSION_KEY)}
