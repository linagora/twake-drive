"use strict";(globalThis.rspackChunkcozy_drive=globalThis.rspackChunkcozy_drive||[]).push([[7],{xDx(e,t,a){function i(e,t){e.accDescr&&t.setAccDescription?.(e.accDescr),e.accTitle&&t.setAccTitle?.(e.accTitle),e.title&&t.setDiagramTitle?.(e.title)}(0,a("do5").K2)(i,"populateCommonDb"),a.d(t,{S:()=>i})},lc(e,t,a){var i=a("qNV"),l=a("xDx"),r=a("VS"),s=a("M7"),o=a("do5"),n=a("LAz"),c=a("IEx"),d=s.UI.pie,p={sections:new Map,showData:!1,config:d},u=p.sections,g=p.showData,h=structuredClone(d),m=(0,o.K2)(()=>structuredClone(h),"getConfig"),x=(0,o.K2)(()=>{u=new Map,g=p.showData,(0,s.IU)()},"clear"),f=(0,o.K2)(({label:e,value:t})=>{if(t<0)throw Error(`"${e}" has invalid value: ${t}. Negative values are not allowed in pie charts. All slice values must be >= 0.`);u.has(e)||(u.set(e,t),o.Rm.debug(`added new section: ${e}, with value: ${t}`))},"addSection"),S=(0,o.K2)(()=>u,"getSections"),w=(0,o.K2)(e=>{g=e},"setShowData"),$=(0,o.K2)(()=>g,"getShowData"),D={getConfig:m,clear:x,setDiagramTitle:s.ke,getDiagramTitle:s.ab,setAccTitle:s.SV,getAccTitle:s.iN,setAccDescription:s.EI,getAccDescription:s.m7,addSection:f,getSections:S,setShowData:w,getShowData:$},T=(0,o.K2)((e,t)=>{(0,l.S)(e,t),t.setShowData(e.showData),e.sections.map(t.addSection)},"populateDb"),y={parse:(0,o.K2)(async e=>{let t=await (0,n.qg)("pie",e);o.Rm.debug(t),T(t,D)},"parse")},C=(0,o.K2)(e=>`
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
`,"getStyles"),v=(0,o.K2)(e=>{let t=[...e.values()].reduce((e,t)=>e+t,0),a=[...e.entries()].map(([e,t])=>({label:e,value:t})).filter(e=>e.value/t*100>=1);return(0,c.rLf)().value(e=>e.value).sort(null)(a)},"createPieArcs"),k={parser:y,db:D,renderer:{draw:(0,o.K2)((e,t,a,l)=>{o.Rm.debug("rendering pie chart\n"+e);let n=l.db,d=(0,s.D7)(),p=(0,r.$t)(n.getConfig(),d.pie),u=(0,i.D)(t),g=u.append("g");g.attr("transform","translate(225,225)");let{themeVariables:h}=d,[m]=(0,r.I5)(h.pieOuterStrokeWidth);m??=2;let x=p.textPosition,f=(0,c.JLW)().innerRadius(0).outerRadius(185),S=(0,c.JLW)().innerRadius(185*x).outerRadius(185*x);g.append("circle").attr("cx",0).attr("cy",0).attr("r",185+m/2).attr("class","pieOuterCircle");let w=n.getSections(),$=v(w),D=[h.pie1,h.pie2,h.pie3,h.pie4,h.pie5,h.pie6,h.pie7,h.pie8,h.pie9,h.pie10,h.pie11,h.pie12],T=0;w.forEach(e=>{T+=e});let y=$.filter(e=>"0"!==(e.data.value/T*100).toFixed(0)),C=(0,c.UMr)(D).domain([...w.keys()]);g.selectAll("mySlices").data(y).enter().append("path").attr("d",f).attr("fill",e=>C(e.data.label)).attr("class","pieCircle"),g.selectAll("mySlices").data(y).enter().append("text").text(e=>(e.data.value/T*100).toFixed(0)+"%").attr("transform",e=>"translate("+S.centroid(e)+")").style("text-anchor","middle").attr("class","slice");let k=g.append("text").text(n.getDiagramTitle()).attr("x",0).attr("y",-200).attr("class","pieTitleText"),b=[...w.entries()].map(([e,t])=>({label:e,value:t})),A=g.selectAll(".legend").data(b).enter().append("g").attr("class","legend").attr("transform",(e,t)=>"translate(216,"+(22*t-22*b.length/2)+")");A.append("rect").attr("width",18).attr("height",18).style("fill",e=>C(e.label)).style("stroke",e=>C(e.label)),A.append("text").attr("x",22).attr("y",14).text(e=>n.getShowData()?`${e.label} [${e.value}]`:e.label);let K=Math.max(...A.selectAll("text").nodes().map(e=>e?.getBoundingClientRect().width??0)),z=k.node()?.getBoundingClientRect().width??0,R=Math.min(0,225-z/2),M=Math.max(512+K,225+z/2)-R;u.attr("viewBox",`${R} 0 ${M} 450`),(0,s.a$)(u,450,M,p.useMaxWidth)},"draw")},styles:C};a.d(t,{diagram:()=>k})}}]);