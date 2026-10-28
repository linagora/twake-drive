"use strict";(globalThis.rspackChunkcozy_drive=globalThis.rspackChunkcozy_drive||[]).push([["s3"],{P0(t,e,a){function r(t,e){t.accDescr&&e.setAccDescription?.(t.accDescr),t.accTitle&&e.setAccTitle?.(t.accTitle),t.title&&e.setDiagramTitle?.(t.title)}(0,a("Gt6").K)(r,"populateCommonDb"),a.d(e,{S:()=>r})},ej(t,e,a){var r=a("P0"),i=a("zgo"),l=a("ieq"),o=a("uG"),s=a("M4"),c=a("Gt6"),n=a("LAz"),d=o.UI.packet,h=class{constructor(){this.packet=[],this.setAccTitle=o.SV,this.getAccTitle=o.iN,this.setDiagramTitle=o.ke,this.getDiagramTitle=o.ab,this.getAccDescription=o.m7,this.setAccDescription=o.EI}static{(0,c.K)(this,"PacketDB")}getConfig(){let t=(0,l.$t)({...d,...(0,o.zj)().packet});return t.showBits&&(t.paddingY+=10),t}getPacket(){return this.packet}pushWord(t){t.length>0&&this.packet.push(t)}clear(){(0,o.IU)(),this.packet=[]}},k=(0,c.K)((t,e)=>{(0,r.S)(t,e);let a=-1,i=[],l=1,{bitsPerRow:o}=e.getConfig();for(let{start:r,end:c,bits:n,label:d}of t.blocks){if(void 0!==r&&void 0!==c&&c<r)throw Error(`Packet block ${r} - ${c} is invalid. End must be greater than start.`);if((r??=a+1)!==a+1)throw Error(`Packet block ${r} - ${c??r} is not contiguous. It should start from ${a+1}.`);if(0===n)throw Error(`Packet block ${r} is invalid. Cannot have a zero bit field.`);for(c??=r+(n??1)-1,n??=c-r+1,a=c,s.R.debug(`Packet block ${r} - ${a} with label ${d}`);i.length<=o+1&&e.getPacket().length<1e4;){let[t,a]=p({start:r,end:c,bits:n,label:d},l,o);if(i.push(t),t.end+1===l*o&&(e.pushWord(i),i=[],l++),!a)break;({start:r,end:c,bits:n,label:d}=a)}}e.pushWord(i)},"populate"),p=(0,c.K)((t,e,a)=>{if(void 0===t.start)throw Error("start should have been set during first phase");if(void 0===t.end)throw Error("end should have been set during first phase");if(t.start>t.end)throw Error(`Block start ${t.start} is greater than block end ${t.end}.`);if(t.end+1<=e*a)return[t,void 0];let r=e*a-1,i=e*a;return[{start:t.start,end:r,label:t.label,bits:r-t.start},{start:i,end:t.end,label:t.label,bits:t.end-i}]},"getNextFittingBlock"),b={parser:{yy:void 0},parse:(0,c.K)(async t=>{let e=await (0,n.qg)("packet",t),a=b.parser?.yy;if(!(a instanceof h))throw Error("parser.parser?.yy was not a PacketDB. This is due to a bug within Mermaid, please report this issue at https://github.com/mermaid-js/mermaid/issues.");s.R.debug(e),k(e,a)},"parse")},g=(0,c.K)((t,e,a,r)=>{let l=r.db,s=l.getConfig(),{rowHeight:c,paddingY:n,bitWidth:d,bitsPerRow:h}=s,k=l.getPacket(),p=l.getDiagramTitle(),b=c+n,g=b*(k.length+1)-(p?0:c),f=d*h+2,y=(0,i.D)(e);for(let[t,e]of(y.attr("viewBox",`0 0 ${f} ${g}`),(0,o.a$)(y,g,f,s.useMaxWidth),k.entries()))u(y,e,t,s);y.append("text").text(p).attr("x",f/2).attr("y",g-b/2).attr("dominant-baseline","middle").attr("text-anchor","middle").attr("class","packetTitle")},"draw"),u=(0,c.K)((t,e,a,{rowHeight:r,paddingX:i,paddingY:l,bitWidth:o,bitsPerRow:s,showBits:c})=>{let n=t.append("g"),d=a*(r+l)+l;for(let t of e){let e=t.start%s*o+1,a=(t.end-t.start+1)*o-i;if(n.append("rect").attr("x",e).attr("y",d).attr("width",a).attr("height",r).attr("class","packetBlock"),n.append("text").attr("x",e+a/2).attr("y",d+r/2).attr("class","packetLabel").attr("dominant-baseline","middle").attr("text-anchor","middle").text(t.label),!c)continue;let l=t.end===t.start,h=d-2;n.append("text").attr("x",e+(l?a/2:0)).attr("y",h).attr("class","packetByte start").attr("dominant-baseline","auto").attr("text-anchor",l?"middle":"start").text(t.start),l||n.append("text").attr("x",e+a).attr("y",h).attr("class","packetByte end").attr("dominant-baseline","auto").attr("text-anchor","end").text(t.end)}},"drawWord"),f={byteFontSize:"10px",startByteColor:"black",endByteColor:"black",labelColor:"black",labelFontSize:"12px",titleColor:"black",titleFontSize:"14px",blockStrokeColor:"black",blockStrokeWidth:"1",blockFillColor:"#efefef"},y={parser:b,get db(){return new h},renderer:{draw:g},styles:(0,c.K)(({packet:t}={})=>{let e=(0,l.$t)(f,t);return`
	.packetByte {
		font-size: ${e.byteFontSize};
	}
	.packetByte.start {
		fill: ${e.startByteColor};
	}
	.packetByte.end {
		fill: ${e.endByteColor};
	}
	.packetLabel {
		fill: ${e.labelColor};
		font-size: ${e.labelFontSize};
	}
	.packetTitle {
		fill: ${e.titleColor};
		font-size: ${e.titleFontSize};
	}
	.packetBlock {
		stroke: ${e.blockStrokeColor};
		stroke-width: ${e.blockStrokeWidth};
		fill: ${e.blockFillColor};
	}
	`},"styles")};a.d(e,{diagram:()=>y})}}]);