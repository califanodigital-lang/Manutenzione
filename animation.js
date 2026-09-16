const alignment = {"1": [[1, 0, 0], [0.995, 10.5, 0.0], [1.0, 10.0, 0.0], [0.995, 21.0, 0.0], [1.0, 0.0, 1.0], [1.005, 10.0, 0.5], [1.005, 9.5, 0.5], [1.005, 20.5, 0.5], [0.995, 0.5, 0.5], [0.995, 10.5, 0.0], [1.0, 10.0, 0.0], [1.005, 20.5, 0.0], [1.0, 0.0, 0.5], [1.005, 10.0, 0.5], [1.005, 9.5, 0.5], [1.0, 21.0, 0.5]], "3": [[1, 0, 0], [1.0, 2.5, 0.0], [0.995, 7.0, 0.0], [0.995, 13.0, 0.0], [0.995, 0.5, 4.0], [0.99, 3.0, 4.5], [1.005, 6.5, 4.0], [1.005, 12.5, 4.0], [0.99, 0.5, 6.0], [0.99, 3.0, 6.0], [0.98, 8.0, 6.5], [0.985, 13.5, 6.5], [0.995, 0.5, 8.5], [0.99, 3.0, 8.5], [0.985, 7.5, 8.5], [0.985, 13.5, 8.5]]};
const toggle = document.querySelector('button');
let paused = false;
const reduced = matchMedia('(prefers-reduced-motion: reduce)');
toggle.addEventListener('click', () => {
  paused = !paused;
  toggle.setAttribute('aria-pressed', String(paused));
  toggle.textContent = paused ? 'Riprendi animazioni' : 'Pausa animazioni';
});
const actors = [];
document.querySelectorAll('canvas.sprite').forEach(canvas => {
  const image = new Image();
  image.onload = () => {
    if(canvas.dataset.person==='4') {
      actors.push({canvas,image,rig:true,last:-1,elapsed:0});
      return;
    }
    const scratch = document.createElement('canvas');
    scratch.width = image.width; scratch.height = image.height;
    const ctx = scratch.getContext('2d', {willReadFrequently:true});
    ctx.drawImage(image,0,0);
    const pixels = ctx.getImageData(0,0,image.width,image.height).data;
    const frames = [];
    for(let n=0;n<16;n++) {
      const x0=Math.round(n%4*image.width/4), y0=Math.round(Math.floor(n/4)*image.height/4);
      const x1=Math.round((n%4+1)*image.width/4), y1=Math.round((Math.floor(n/4)+1)*image.height/4);
      let left=x1,top=y1,right=x0,bottom=y0;
      for(let y=y0;y<y1;y++) for(let x=x0;x<x1;x++) {
        if(pixels[(y*image.width+x)*4+3]>100){left=Math.min(left,x);right=Math.max(right,x);top=Math.min(top,y);bottom=Math.max(bottom,y);}
      }
      if(canvas.dataset.person==='3') {
        // Ignore isolated fragments from the adjacent sprite-sheet cells.
        const cw=x1-x0,ch=y1-y0,seen=new Uint8Array(cw*ch);
        let largest=0;
        for(let seed=0;seed<seen.length;seed++) {
          if(seen[seed])continue;
          seen[seed]=1;
          const sx=seed%cw,sy=Math.floor(seed/cw);
          if(pixels[((y0+sy)*image.width+x0+sx)*4+3]<128)continue;
          const queue=[seed];let count=0,l=sx,r=sx,t=sy,b=sy;
          for(let head=0;head<queue.length;head++) {
            const index=queue[head],xx=index%cw,yy=Math.floor(index/cw);
            count++;l=Math.min(l,xx);r=Math.max(r,xx);t=Math.min(t,yy);b=Math.max(b,yy);
            for(const [nx,ny] of [[xx-1,yy],[xx+1,yy],[xx,yy-1],[xx,yy+1]]) {
              if(nx<0||ny<0||nx>=cw||ny>=ch)continue;
              const next=ny*cw+nx;if(seen[next])continue;seen[next]=1;
              if(pixels[((y0+ny)*image.width+x0+nx)*4+3]>=128)queue.push(next);
            }
          }
          if(count>largest){largest=count;left=x0+l;right=x0+r;top=y0+t;bottom=y0+b;}
        }
      }
      frames.push({x:left,y:top,w:right-left+1,h:bottom-top+1,cellX:x0,cellY:y0,cellW:x1-x0,cellH:y1-y0});
    }
    const poses = frames.map((f,index) => {
      const pose = document.createElement('canvas');
      pose.width=480; pose.height=480;
      const painter=pose.getContext('2d');
      painter.fillStyle='#ffffff'; painter.fillRect(0,0,480,480);
      const correction=alignment[canvas.dataset.person]?.[index];
      if(correction) {
        const base=frames[0],scale=Math.min(420/base.h,440/base.w);
        const [s,dx,dy]=correction;
        const originX=(480-base.w*scale)/2-base.x*scale;
        const originY=452-base.h*scale-base.y*scale;
        painter.drawImage(image,f.x,f.y,f.w,f.h,
          originX+(dx*f.cellW/128+(f.x-f.cellX)*s)*scale,
          originY+(dy*f.cellH/128+(f.y-f.cellY)*s)*scale,
          f.w*s*scale,f.h*s*scale);
      } else {
        const scale=Math.min(420/f.h,440/f.w),w=f.w*scale,h=f.h*scale;
        painter.drawImage(image,f.x,f.y,f.w,f.h,(480-w)/2,452-h,w,h);
      }
      return pose;
    });
    actors.push({canvas,poses,person:Number(canvas.dataset.person),last:-1,elapsed:0,interval:[110,95,145,95,100][Number(canvas.dataset.person)-1]});
  };
  image.src = canvas.dataset.person==='4' ? 'emanuele-layers.png' : `quokka-${canvas.dataset.person}-16.png`;
});
let previous = 0;
function tick(now) {
  const delta = previous ? Math.min(now-previous,50) : 0;
  previous=now;
  actors.forEach(actor => {
    if(!paused && !reduced.matches && !document.hidden) actor.elapsed+=delta;
    if(actor.rig) {
      // Sixteen distinct arm poses; the base and tablet remain identical.
      const poseIndex=reduced.matches ? 0 : Math.floor(actor.elapsed/125)%16;
      const time=poseIndex*(3400/16);
      if(actor.last===time)return;
      actor.last=time;
      const context=actor.canvas.getContext('2d'),pw=actor.image.width/2,ph=actor.image.height;
      const scale=420/ph,w=pw*scale,h=420,x=(480-w)/2,y=452-h;
      context.clearRect(0,0,480,480);
      context.drawImage(actor.image,0,0,pw,ph,x,y,w,h);
      context.save();
      const pivotX=x+w*.26,pivotY=y+h*.60;
      // Scan three areas of the screen, pausing briefly at each result.
      // Only the separate arm layer moves; the tablet is never transformed.
      const stops = [
        {at:0, angle:-.12, dx:0, dy:-3},
        {at:.12, angle:-.12, dx:0, dy:-3},
        {at:.34, angle:.08, dx:13, dy:8},
        {at:.45, angle:.08, dx:13, dy:8},
        {at:.66, angle:.30, dx:21, dy:18},
        {at:.77, angle:.30, dx:21, dy:18},
        {at:1, angle:-.12, dx:0, dy:-3}
      ];
      const phase=(time%3400)/3400;
      const end=stops.findIndex(point=>point.at>phase);
      const a=stops[Math.max(0,end-1)],b=stops[end];
      const t=(phase-a.at)/(b.at-a.at),ease=t*t*(3-2*t);
      const angle=a.angle+(b.angle-a.angle)*ease;
      const dx=a.dx+(b.dx-a.dx)*ease,dy=a.dy+(b.dy-a.dy)*ease;
      context.translate(pivotX+dx,pivotY+dy);
      context.rotate(angle);
      context.translate(-pivotX,-pivotY);
      context.drawImage(actor.image,pw,0,pw,ph,x+w*.085,y-h*.018,w,h);
      context.restore();
      return;
    }
    const frame=reduced.matches ? 0 : Math.floor(actor.elapsed/actor.interval)%16;
    if(frame===actor.last)return;
    actor.last=frame;
    const context=actor.canvas.getContext('2d');
    context.globalAlpha=1;
    context.drawImage(actor.poses[frame],0,0);
  });
  requestAnimationFrame(tick);
}
requestAnimationFrame(tick);

