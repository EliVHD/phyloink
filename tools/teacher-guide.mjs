// Render the trusted, repository-authored guide subset; no runtime Markdown dependency.
const escape = text => text.replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');
const slug = text => text.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
const inline = text => {
  const codes=[];
  let html=escape(text).replace(/`([^`]+)`/g,(_,code)=>`@@CODE${codes.push(`<code>${code}</code>`)-1}@@`);
  html=html.replace(/\[([^\]]+)\]\(([^)]+)\)/g,(_,label,url)=>{
    if(!/^(https?:\/\/|\/?[a-z0-9#])/i.test(url)||url.includes('&quot;'))throw new Error(`Unsupported guide URL: ${url}`);
    return `<a href="${url}">${label}</a>`;
  }).replace(/\*\*([^*]+)\*\*/g,'<strong>$1</strong>').replace(/\*([^*]+)\*/g,'<em>$1</em>');
  return html.replace(/@@CODE(\d+)@@/g,(_,n)=>codes[Number(n)]);
};
export function teacherGuideHTML(markdown) {
  const lines=markdown.replaceAll('\r\n','\n').split('\n'), output=[], headings=[];
  for(let i=0;i<lines.length;){
    const line=lines[i].trim();
    if(!line){i++;continue;}
    if(line.startsWith('```')){
      const code=[];i++;while(i<lines.length&&!lines[i].startsWith('```'))code.push(lines[i++]);
      if(i===lines.length)throw new Error('Unclosed guide code block.');
      output.push(`<pre><code>${escape(code.join('\n'))}</code></pre>`);i++;continue;
    }
    const heading=/^(#{1,6}) (.+)$/.exec(line);
    if(heading){const level=heading[1].length,id=slug(heading[2]);if(level===2&&/^(\d+\.|First activity)/.test(heading[2]))headings.push({id,text:heading[2]});output.push(`<h${level} id="${id}">${inline(heading[2])}</h${level}>`);i++;continue;}
    if(line==='---'){output.push('<hr>');i++;continue;}
    if(line.startsWith('|')){
      const rows=[];while(i<lines.length&&lines[i].trim().startsWith('|'))rows.push(lines[i++].trim().slice(1,-1).split('|').map(x=>x.trim()));
      if(rows.length<2||!rows[1].every(x=>/^:?-+:?$/.test(x)))throw new Error('Unsupported guide table.');
      const row=(cells,tag)=>'<tr>'+cells.map(x=>`<${tag}>${inline(x)}</${tag}>`).join('')+'</tr>';
      output.push('<div class="table-scroll"><table><thead>'+row(rows[0],'th')+'</thead><tbody>'+rows.slice(2).map(x=>row(x,'td')).join('')+'</tbody></table></div>');continue;
    }
    if(/^(- |\d+\. )/.test(line)){
      const ordered=/^\d/.test(line), items=[];
      while(i<lines.length&&(ordered?/^\d+\. /:/^- /).test(lines[i].trim()))items.push(lines[i++].trim().replace(/^(?:- |\d+\. )/,''));
      const tag=ordered?'ol':'ul';output.push(`<${tag}>`+items.map(x=>`<li>${inline(x.replace(/^\[ \] /,'☐ '))}</li>`).join('')+`</${tag}>`);continue;
    }
    const paragraph=[line];i++;
    while(i<lines.length&&lines[i].trim()&&!/^(#|---|\||- |\d+\. |```)/.test(lines[i].trim()))paragraph.push(lines[i++].trim());
    const text=paragraph.join(' ');
    output.push(/^https?:\/\/\S+$/.test(text)?`<p><a href="${escape(text)}">${escape(text)}</a></p>`:`<p>${inline(text)}</p>`);
  }
  const contents='<nav aria-label="Teacher’s Guide contents"><h2>Contents</h2><ul>'+headings.map(h=>`<li><a href="#${h.id}">${inline(h.text)}</a></li>`).join('')+'</ul></nav>';
  const content=output.join('\n'),first=headings[0],body=first?content.replace(`<h2 id="${first.id}">`,contents+`<h2 id="${first.id}">`):content;
  return '<!doctype html>\n<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="description" content="Prepare scientifically grounded classroom diagrams and adaptable activities with PhyloInk."><title>Teacher’s Guide — PhyloInk</title><link rel="stylesheet" href="/teaching.css"></head><body><header><strong>PhyloInk · Teacher’s Guide</strong><div><a href="/">Editor</a> · <a href="/guide.html">Usage guide</a></div></header><main>'+body+'</main><footer>PhyloInk · Original guide under 0BSD · <a href="/guide.html">Usage guide</a> · <a href="/third-party-notices.html">Sources &amp; licenses</a></footer></body></html>\n';
}
