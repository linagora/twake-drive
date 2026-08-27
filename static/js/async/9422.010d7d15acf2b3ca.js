"use strict";(self.webpackChunkcozy_drive=self.webpackChunkcozy_drive||[]).push([["9422"],{79719:function(e,t,a){function i(e,t){e.accDescr&&t.setAccDescription?.(e.accDescr),e.accTitle&&t.setAccTitle?.(e.accTitle),e.title&&t.setDiagramTitle?.(e.title)}a.d(t,{S:()=>i}),(0,a(22821).K2)(i,"populateCommonDb")},301:function(e,t,a){a.d(t,{diagram:()=>k});var i=a(86026),l=a(79719),r=a(18903),n=a(43868),s=a(22821),o=a(98912),c=a(26629),p=n.UI.pie,d={sections:new Map,showData:!1,config:p},u=d.sections,g=d.showData,h=structuredClone(p),f=(0,s.K2)(()=>structuredClone(h),"getConfig"),m=(0,s.K2)(()=>{u=new Map,g=d.showData,(0,n.IU)()},"clear"),x=(0,s.K2)(({label:e,value:t})=>{if(t<0)throw Error(`"${e}" has invalid value: ${t}. Negative values are not allowed in pie charts. All slice values must be >= 0.`);u.has(e)||(u.set(e,t),s.Rm.debug(`added new section: ${e}, with value: ${t}`))},"addSection"),w=(0,s.K2)(()=>u,"getSections"),S=(0,s.K2)(e=>{g=e},"setShowData"),$=(0,s.K2)(()=>g,"getShowData"),y={getConfig:f,clear:m,setDiagramTitle:n.ke,getDiagramTitle:n.ab,setAccTitle:n.SV,getAccTitle:n.iN,setAccDescription:n.EI,getAccDescription:n.m7,addSection:x,getSections:w,setShowData:S,getShowData:$},D=(0,s.K2)((e,t)=>{(0,l.S)(e,t),t.setShowData(e.showData),e.sections.map(t.addSection)},"populateDb"),T={parse:(0,s.K2)(async e=>{let t=await (0,o.qg)("pie",e);s.Rm.debug(t),D(t,y)},"parse")},C=(0,s.K2)(e=>`
  .pieCircle{
    stroke: ${e.pieStrokeColor};
    stroke-width : ${e.pieStrokeWidth};
    opacity : ${e.pieOpacity};
  }
  .pieOuterCircle{
    stroke: ${e.pieOuterStrokeColor};
    stroke-width: ${e.pieOuterStrokeWidth};
    fill: none;
  }
  .pieTitleText {
    text-anchor: middle;
    font-size: ${e.pieTitleTextSize};
    fill: ${e.pieTitleTextColor};
    font-family: ${e.fontFamily};
  }
  .slice {
    font-family: ${e.fontFamily};
    fill: ${e.pieSectionTextColor};
    font-size:${e.pieSectionTextSize};
    // fill: white;
  }
  .legend text {
    fill: ${e.pieLegendTextColor};
    font-family: ${e.fontFamily};
    font-size: ${e.pieLegendTextSize};
  }
`,"getStyles"),v=(0,s.K2)(e=>{let t=[...e.values()].reduce((e,t)=>e+t,0),a=[...e.entries()].map(([e,t])=>({label:e,value:t})).filter(e=>e.value/t*100>=1);return(0,c.rLf)().value(e=>e.value).sort(null)(a)},"createPieArcs"),k={parser:T,db:y,renderer:{draw:(0,s.K2)((e,t,a,l)=>{s.Rm.debug("rendering pie chart\n"+e);let o=l.db,p=(0,n.D7)(),d=(0,r.$t)(o.getConfig(),p.pie),u=(0,i.D)(t),g=u.append("g");g.attr("transform","translate(225,225)");let{themeVariables:h}=p,[f]=(0,r.I5)(h.pieOuterStrokeWidth);f??=2;let m=d.textPosition,x=(0,c.JLW)().innerRadius(0).outerRadius(185),w=(0,c.JLW)().innerRadius(185*m).outerRadius(185*m);g.append("circle").attr("cx",0).attr("cy",0).attr("r",185+f/2).attr("class","pieOuterCircle");let S=o.getSections(),$=v(S),y=[h.pie1,h.pie2,h.pie3,h.pie4,h.pie5,h.pie6,h.pie7,h.pie8,h.pie9,h.pie10,h.pie11,h.pie12],D=0;S.forEach(e=>{D+=e});let T=$.filter(e=>"0"!==(e.data.value/D*100).toFixed(0)),C=(0,c.UMr)(y).domain([...S.keys()]);g.selectAll("mySlices").data(T).enter().append("path").attr("d",x).attr("fill",e=>C(e.data.label)).attr("class","pieCircle"),g.selectAll("mySlices").data(T).enter().append("text").text(e=>(e.data.value/D*100).toFixed(0)+"%").attr("transform",e=>"translate("+w.centroid(e)+")").style("text-anchor","middle").attr("class","slice");let k=g.append("text").text(o.getDiagramTitle()).attr("x",0).attr("y",-200).attr("class","pieTitleText"),b=[...S.entries()].map(([e,t])=>({label:e,value:t})),A=g.selectAll(".legend").data(b).enter().append("g").attr("class","legend").attr("transform",(e,t)=>"translate(216,"+(22*t-22*b.length/2)+")");A.append("rect").attr("width",18).attr("height",18).style("fill",e=>C(e.label)).style("stroke",e=>C(e.label)),A.append("text").attr("x",22).attr("y",14).text(e=>o.getShowData()?`${e.label} [${e.value}]`:e.label);let K=Math.max(...A.selectAll("text").nodes().map(e=>e?.getBoundingClientRect().width??0)),R=k.node()?.getBoundingClientRect().width??0,z=Math.min(0,225-R/2),M=Math.max(512+K,225+R/2)-z;u.attr("viewBox",`${z} 0 ${M} 450`),(0,n.a$)(u,450,M,d.useMaxWidth)},"draw")},styles:C}}}]);