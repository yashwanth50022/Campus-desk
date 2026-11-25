const API='/api/v1';
let refreshing=null;

async function request(path,options={},retry=true){
 const response=await fetch(`${API}${path}`,{...options,credentials:'include',headers:{...(options.body?{'Content-Type':'application/json'}:{}),...options.headers}});
 if(response.status===401&&retry&&!['/auth/login','/auth/refresh','/auth/logout','/auth/password-reset/request','/auth/password-reset/confirm'].includes(path)){
  if(!refreshing)refreshing=fetch(`${API}/auth/refresh`,{method:'POST',credentials:'include'}).finally(()=>{refreshing=null;});
  const refreshed=await refreshing;
  if(refreshed.ok)return request(path,options,false);
 }
 const contentType=response.headers.get('content-type')||'';
 if(!response.ok){const data=contentType.includes('application/json')?await response.json():{error:{message:'The request failed.'}};throw new Error(data.error?.message||'The request failed.');}
 return contentType.includes('application/json')?response.json():response.text();
}
export const api={
 get:(path)=>request(path),
 post:(path,body)=>request(path,{method:'POST',body:JSON.stringify(body)}),
 put:(path,body)=>request(path,{method:'PUT',body:JSON.stringify(body)}),
 patch:(path,body)=>request(path,{method:'PATCH',body:JSON.stringify(body)}),
 download:async(path)=>{const r=await fetch(`${API}${path}`,{credentials:'include'});if(!r.ok)throw new Error('Could not download report.');return r.blob();},
};
