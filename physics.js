(function(root){
  'use strict';
  const Physics = {
    momentumSD(sigma, chirp=0){return Math.sqrt(1+chirp*chirp)/(2*sigma);},
    density(x,mean,sd){return Math.exp(-0.5*((x-mean)/sd)**2)/(sd*Math.sqrt(2*Math.PI));},
    normal(mean,sd,random=Math.random){
      const u=1-random(), v=random();
      return mean+sd*Math.sqrt(-2*Math.log(u))*Math.cos(2*Math.PI*v);
    },
    stats(values){
      if(!values.length) return {mean:null,sd:null};
      let mean=0,m2=0;
      values.forEach((v,i)=>{const d=v-mean;mean+=d/(i+1);m2+=d*(v-mean);});
      return {mean,sd:values.length>1?Math.sqrt(m2/(values.length-1)):null};
    },
    bins(values,min,max,count){
      const bins=Array(count).fill(0);let outside=0;
      for(const value of values){const i=Math.floor((value-min)/(max-min)*count);if(i>=0&&i<count) bins[i]++;else outside++;}
      return {bins,outside,width:(max-min)/count};
    }
  };
  root.QuantumPhysics=Physics;
  if(typeof module!=='undefined') module.exports=Physics;
})(typeof window!=='undefined'?window:globalThis);
