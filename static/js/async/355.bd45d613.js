"use strict";(self.webpackChunkcozy_drive=self.webpackChunkcozy_drive||[]).push([["355"],{79719:function(t,e,a){function r(t,e){t.accDescr&&e.setAccDescription?.(t.accDescr),t.accTitle&&e.setAccTitle?.(t.accTitle),t.title&&e.setDiagramTitle?.(t.title)}a.d(e,{S:()=>r}),(0,a(22821).K2)(r,"populateCommonDb")},64254:function(t,e,a){a.d(e,{diagram:()=>O});var r=a(86026),i=a(79719),n=a(18903),l=a(43868),s=a(22821),o=a(98912),c={showLegend:!0,ticks:5,max:null,min:0,graticule:"circle"},d={axes:[],curves:[],options:c},g=structuredClone(d),u=l.UI.radar,h=(0,s.K2)(()=>(0,n.$t)({...u,...(0,l.zj)().radar}),"getConfig"),p=(0,s.K2)(()=>g.axes,"getAxes"),x=(0,s.K2)(()=>g.curves,"getCurves"),m=(0,s.K2)(()=>g.options,"getOptions"),$=(0,s.K2)(t=>{g.axes=t.map(t=>({name:t.name,label:t.label??t.name}))},"setAxes"),f=(0,s.K2)(t=>{g.curves=t.map(t=>({name:t.name,label:t.label??t.name,entries:y(t.entries)}))},"setCurves"),y=(0,s.K2)(t=>{if(void 0==t[0].axis)return t.map(t=>t.value);let e=p();if(0===e.length)throw Error("Axes must be populated before curves for reference entries");return e.map(e=>{let a=t.find(t=>t.axis?.$refText===e.name);if(void 0===a)throw Error("Missing entry for axis "+e.label);return a.value})},"computeCurveEntries"),v={getAxes:p,getCurves:x,getOptions:m,setAxes:$,setCurves:f,setOptions:(0,s.K2)(t=>{let e=t.reduce((t,e)=>(t[e.name]=e,t),{});g.options={showLegend:e.showLegend?.value??c.showLegend,ticks:e.ticks?.value??c.ticks,max:e.max?.value??c.max,min:e.min?.value??c.min,graticule:e.graticule?.value??c.graticule}},"setOptions"),getConfig:h,clear:(0,s.K2)(()=>{(0,l.IU)(),g=structuredClone(d)},"clear"),setAccTitle:l.SV,getAccTitle:l.iN,setDiagramTitle:l.ke,getDiagramTitle:l.ab,getAccDescription:l.m7,setAccDescription:l.EI},w=(0,s.K2)(t=>{(0,i.S)(t,v);let{axes:e,curves:a,options:r}=t;v.setAxes(e),v.setCurves(a),v.setOptions(r)},"populate"),b={parse:(0,s.K2)(async t=>{let e=await (0,o.qg)("radar",t);s.Rm.debug(e),w(e)},"parse")},C=(0,s.K2)((t,e,a,i)=>{let n=i.db,l=n.getAxes(),s=n.getCurves(),o=n.getOptions(),c=n.getConfig(),d=n.getDiagramTitle(),g=M((0,r.D)(e),c),u=o.max??Math.max(...s.map(t=>Math.max(...t.entries))),h=o.min,p=Math.min(c.width,c.height)/2;K(g,l,p,o.ticks,o.graticule),L(g,l,p,c),T(g,l,s,h,u,o.graticule,c),S(g,s,o.showLegend,c),g.append("text").attr("class","radarTitle").text(d).attr("x",0).attr("y",-c.height/2-c.marginTop)},"draw"),M=(0,s.K2)((t,e)=>{let a=e.width+e.marginLeft+e.marginRight,r=e.height+e.marginTop+e.marginBottom,i={x:e.marginLeft+e.width/2,y:e.marginTop+e.height/2};return(0,l.a$)(t,r,a,e.useMaxWidth??!0),t.attr("viewBox",`0 0 ${a} ${r}`),t.append("g").attr("transform",`translate(${i.x}, ${i.y})`)},"drawFrame"),K=(0,s.K2)((t,e,a,r,i)=>{if("circle"===i)for(let e=0;e<r;e++){let i=a*(e+1)/r;t.append("circle").attr("r",i).attr("class","radarGraticule")}else if("polygon"===i){let i=e.length;for(let n=0;n<r;n++){let l=a*(n+1)/r,s=e.map((t,e)=>{let a=2*e*Math.PI/i-Math.PI/2,r=l*Math.cos(a),n=l*Math.sin(a);return`${r},${n}`}).join(" ");t.append("polygon").attr("points",s).attr("class","radarGraticule")}}},"drawGraticule"),L=(0,s.K2)((t,e,a,r)=>{let i=e.length;for(let n=0;n<i;n++){let l=e[n].label,s=2*n*Math.PI/i-Math.PI/2;t.append("line").attr("x1",0).attr("y1",0).attr("x2",a*r.axisScaleFactor*Math.cos(s)).attr("y2",a*r.axisScaleFactor*Math.sin(s)).attr("class","radarAxisLine"),t.append("text").text(l).attr("x",a*r.axisLabelFactor*Math.cos(s)).attr("y",a*r.axisLabelFactor*Math.sin(s)).attr("class","radarAxisLabel")}},"drawAxes");function T(t,e,a,r,i,n,l){let s=e.length,o=Math.min(l.width,l.height)/2;a.forEach((e,a)=>{if(e.entries.length!==s)return;let c=e.entries.map((t,e)=>{let a=2*Math.PI*e/s-Math.PI/2,n=k(t,r,i,o);return{x:n*Math.cos(a),y:n*Math.sin(a)}});"circle"===n?t.append("path").attr("d",A(c,l.curveTension)).attr("class",`radarCurve-${a}`):"polygon"===n&&t.append("polygon").attr("points",c.map(t=>`${t.x},${t.y}`).join(" ")).attr("class",`radarCurve-${a}`)})}function k(t,e,a,r){return r*(Math.min(Math.max(t,e),a)-e)/(a-e)}function A(t,e){let a=t.length,r=`M${t[0].x},${t[0].y}`;for(let i=0;i<a;i++){let n=t[(i-1+a)%a],l=t[i],s=t[(i+1)%a],o=t[(i+2)%a],c={x:l.x+(s.x-n.x)*e,y:l.y+(s.y-n.y)*e},d={x:s.x-(o.x-l.x)*e,y:s.y-(o.y-l.y)*e};r+=` C${c.x},${c.y} ${d.x},${d.y} ${s.x},${s.y}`}return`${r} Z`}function S(t,e,a,r){if(!a)return;let i=(r.width/2+r.marginRight)*3/4,n=-(3*(r.height/2+r.marginTop))/4;e.forEach((e,a)=>{let r=t.append("g").attr("transform",`translate(${i}, ${n+20*a})`);r.append("rect").attr("width",12).attr("height",12).attr("class",`radarLegendBox-${a}`),r.append("text").attr("x",16).attr("y",0).attr("class","radarLegendText").text(e.label)})}(0,s.K2)(T,"drawCurves"),(0,s.K2)(k,"relativeRadius"),(0,s.K2)(A,"closedRoundCurve"),(0,s.K2)(S,"drawLegend");var I=(0,s.K2)((t,e)=>{let a="";for(let r=0;r<t.THEME_COLOR_LIMIT;r++){let i=t[`cScale${r}`];a+=`
		.radarCurve-${r} {
			color: ${i};
			fill: ${i};
			fill-opacity: ${e.curveOpacity};
			stroke: ${i};
			stroke-width: ${e.curveStrokeWidth};
		}
		.radarLegendBox-${r} {
			fill: ${i};
			fill-opacity: ${e.curveOpacity};
			stroke: ${i};
		}
		`}return a},"genIndexStyles"),D=(0,s.K2)(t=>{let e=(0,l.P$)(),a=(0,l.zj)(),r=(0,n.$t)(e,a.themeVariables),i=(0,n.$t)(r.radar,t);return{themeVariables:r,radarOptions:i}},"buildRadarStyleOptions"),O={parser:b,db:v,renderer:{draw:C},styles:(0,s.K2)(({radar:t}={})=>{let{themeVariables:e,radarOptions:a}=D(t);return`
	.radarTitle {
		font-size: ${e.fontSize};
		color: ${e.titleColor};
		dominant-baseline: hanging;
		text-anchor: middle;
	}
	.radarAxisLine {
		stroke: ${a.axisColor};
		stroke-width: ${a.axisStrokeWidth};
	}
	.radarAxisLabel {
		dominant-baseline: middle;
		text-anchor: middle;
		font-size: ${a.axisLabelFontSize}px;
		color: ${a.axisColor};
	}
	.radarGraticule {
		fill: ${a.graticuleColor};
		fill-opacity: ${a.graticuleOpacity};
		stroke: ${a.graticuleColor};
		stroke-width: ${a.graticuleStrokeWidth};
	}
	.radarLegendText {
		text-anchor: start;
		font-size: ${a.legendFontSize}px;
		dominant-baseline: hanging;
	}
	${I(e,a)}
	`},"styles")}}}]);