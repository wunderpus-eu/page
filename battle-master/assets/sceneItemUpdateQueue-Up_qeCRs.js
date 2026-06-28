function u(){let e=Promise.resolve();return{enqueue(t){const n=e.then(t,t);return e=n.then(()=>{},()=>{}),n}}}const r=u();function o(e){return r.enqueue(e)}export{o as e};
