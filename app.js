function norm(s){return (s||"").trim()}
function normLower(s){return norm(s).toLowerCase()}
function normalizeMarkerText(s){return normLower(s).replace(/[^a-z0-9\s]/g," ").replace(/\s+/g," ").trim()}
function parse(rawText){
  var lines=rawText.split(/\r?\n/), cats={}
  var defs=[
    {id:"level1", title:"Other Hubs", level:1, marker:"other hubs:"},
    {id:"level2", title:"Own Website / Google Site", level:2, marker:"lists that have their own website/google site:"},
    {id:"level3_docs", title:"Google Docs – Docs", level:3, marker:"docs:"},
    {id:"level3_sheets", title:"Google Docs – Spreadsheets", level:3, marker:"spreadsheets:"},
    {id:"no_discord", title:"Discord-only", level:null, marker:"lists that (only) exists in a discord server:"},
    {id:"no_backup", title:"Backups", level:null, marker:"Backups of existing lists (actually intended to be a backup):"},
    {id:"level4", title:"Discontinued / Not Working", level:4, marker:"Lists that are discontinued/not working right now:"}
  ]
  defs.forEach(function(d){cats[d.id]={meta:d,items:[]}})
  var current=null
  for(var i=0;i<lines.length;i++){
    var line=lines[i], l=normLower(line), ln=normalizeMarkerText(line)
    if(!l) continue
    var found=null
    for(var j=0;j<defs.length;j++){
      var m=defs[j].marker, mm=normalizeMarkerText(m), ml=normalizeMarkerText(line)
      if(l===normLower(m) || ln.startsWith(mm) || ml.startsWith(mm)){ found=defs[j]; break }
    }
    if(found){ current=cats[found.id]; continue }
    if(!current) continue
    if(l==="---") continue
    var title="", url=""
    var m=line.match(/^(.*?):\s*(https?:\/\/.*)$/)
    if(m){ title=norm(m[1]); url=norm(m[2]) }
    else{
      var idx=line.indexOf(": ")
      if(idx<0) idx=line.indexOf(":")
      if(idx<0) continue
      title=norm(line.slice(0,idx))
      url=norm(line.slice(idx+1))
    }
    if(!title) continue
    if(url&&url===title) url=""
    current.items.push({title:title,url:url,removed:false})
  }
  return cats
}
function dedupe(cats){
  var levels=["level1","level2","level3_docs","level3_sheets","level4"]
  var byUrl={}, byTitleHost={}, byTitleOnlyNoUrl={}
  levels.forEach(function(k){
    var cat=cats[k]
    var lvl=cat.meta.level
    cat.items.forEach(function(it,idx){
      var urlKey=normLower(it.url)
      if(urlKey){
        if(!byUrl[urlKey]) byUrl[urlKey]=[]
        byUrl[urlKey].push({cat:k,lvl:lvl,idx:idx})
        var host=""
        try{ host=new URL(it.url,location.href).hostname }catch(e){ host="" }
        if(host){
          var th=normLower(it.title)+"@"+host
          if(!byTitleHost[th]) byTitleHost[th]=[]
          byTitleHost[th].push({cat:k,lvl:lvl,idx:idx})
        }
      }else{
        var tOnly=normLower(it.title)
        if(tOnly){
          if(!byTitleOnlyNoUrl[tOnly]) byTitleOnlyNoUrl[tOnly]=[]
          byTitleOnlyNoUrl[tOnly].push({cat:k,lvl:lvl,idx:idx})
        }
      }
    })
  })
  function applyAcross(map){
    Object.keys(map).forEach(function(key){
      var arr=map[key]
      var minLvl=arr.reduce(function(a,b){return Math.min(a,b.lvl)},99)
      var canonical=arr.find(function(r){return r.lvl===minLvl})||arr[0]
      arr.forEach(function(ref){
        if(ref.lvl>minLvl){
          var it=cats[ref.cat].items[ref.idx]
          it.removed=true
          it.duplicateOf=canonical.cat
          it.reason=(map===byUrl?"same url":map===byTitleHost?"same title@host":"same title")
        }
      })
    })
  }
  applyAcross(byUrl)
  applyAcross(byTitleHost)
  applyAcross(byTitleOnlyNoUrl)
  levels.forEach(function(k){
    var cat=cats[k]
    var seenLink={}, seenTitle={}
    for(var i=0;i<cat.items.length;i++){
      var it=cat.items[i]
      if(it.removed) continue
      var lk=normLower(it.url)
      if(lk){
        if(seenLink[lk]!==undefined){
          var prevIdx=seenLink[lk]
          cat.items[prevIdx].removed=true
          cat.items[prevIdx].duplicateOf=cat.meta.id
          cat.items[prevIdx].reason="same url (same level)"
          seenLink[lk]=i
        } else { seenLink[lk]=i }
        var host=""
        try{ host=new URL(it.url,location.href).hostname }catch(e){ host="" }
        if(host){
          var th=normLower(it.title)+"@"+host
          if(!seenTitle[th]) seenTitle[th]=i
          else {
            var prev=seenTitle[th]
            cat.items[prev].removed=true
            cat.items[prev].duplicateOf=cat.meta.id
            cat.items[prev].reason="same title@host (same level)"
            seenTitle[th]=i
          }
        }
      }else{
        var tkOnly=normLower(it.title)
        if(tkOnly){
          if(seenTitle[tkOnly]!==undefined){
            var prev2=seenTitle[tkOnly]
            cat.items[prev2].removed=true
            cat.items[prev2].duplicateOf=cat.meta.id
            cat.items[prev2].reason="same title (same level)"
            seenTitle[tkOnly]=i
          } else { seenTitle[tkOnly]=i }
        }
      }
    }
  })
  return cats
}
function makeSection(catId,catData){
  var section=document.createElement("div")
  section.className="section"
  var header=document.createElement("div")
  header.className="section-header"
  var arrow=document.createElement("span")
  arrow.className="arrow"
  arrow.textContent="▸"
  var title=document.createElement("div")
  title.className="section-title"
  title.textContent=catData.meta.title
  var controls=document.createElement("div")
  controls.className="controls"
  var count=document.createElement("div")
  var visibleCount=catData.items.filter(function(it){return !it.removed}).length
  count.className="count"
  count.textContent=visibleCount+" items"
  var btn=document.createElement("button")
  btn.className="toggle"
  btn.textContent="Expand"
  var titleWrap=document.createElement("div")
  titleWrap.style.display="flex"
  titleWrap.style.alignItems="center"
  titleWrap.appendChild(arrow)
  titleWrap.appendChild(title)
  header.appendChild(titleWrap)
  controls.appendChild(count)
  controls.appendChild(btn)
  header.appendChild(controls)
  var list=document.createElement("div")
  list.className="list"
  var search=document.createElement("div")
  search.className="search"
  var searchWrap=document.createElement("div")
  searchWrap.className="search-wrap"
  var icon=document.createElementNS("http://www.w3.org/2000/svg","svg")
  icon.setAttribute("class","search-icon")
  icon.setAttribute("viewBox","0 0 24 24")
  var path=document.createElementNS("http://www.w3.org/2000/svg","path")
  path.setAttribute("fill","currentColor")
  path.setAttribute("d","M15.5 14h-.79l-.28-.27A6.471 6.471 0 0 0 16 9.5 6.5 6.5 0 1 0 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 5L20.49 19l-5-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z")
  icon.appendChild(path)
  var input=document.createElement("input")
  input.setAttribute("class","search-input")
  input.setAttribute("type","text")
  input.setAttribute("placeholder","Search this category...")
  input.setAttribute("aria-label","Search this category")
  var controls2=document.createElement("div")
  controls2.className="search-controls"
  var btnSearch=document.createElement("button")
  btnSearch.className="btn"
  btnSearch.textContent="Search"
  btnSearch.setAttribute("aria-label","Execute search")
  var btnClear=document.createElement("button")
  btnClear.className="btn"
  btnClear.textContent="Clear"
  btnClear.setAttribute("aria-label","Clear search")
  controls2.appendChild(btnSearch)
  controls2.appendChild(btnClear)
  searchWrap.appendChild(icon)
  searchWrap.appendChild(input)
  searchWrap.appendChild(controls2)
  var loading=document.createElement("div")
  loading.className="loading"
  loading.textContent="Filtering…"
  search.appendChild(searchWrap)
  search.appendChild(loading)
  list.appendChild(search)
  var rows=[]
  catData.items.forEach(function(it){
    if(it.removed) return
    var row=document.createElement("div")
    row.className="item"
    var left=document.createElement("div")
    var right=document.createElement("div")
    right.className="muted"
    if(it.url){
      var a=document.createElement("a")
      a.href=it.url
      a.target="_blank"
      a.rel="noopener"
      a.textContent=it.title
      left.appendChild(a)
    } else {
      var span=document.createElement("span")
      span.textContent=it.title
      left.appendChild(span)
      var b=document.createElement("span")
      b.className="badge"
      b.textContent="no link"
      left.appendChild(b)
    }
    if(it.url){
      var host=""
      try{ host=new URL(it.url,location.href).hostname }catch(e){ host="invalid link" }
      right.textContent=host
    }
    row.appendChild(left)
    row.appendChild(right)
    list.appendChild(row)
    rows.push({el:row,text:(it.title||"")})
  })
  var noRes=document.createElement("div")
  noRes.className="no-results"
  noRes.setAttribute("role","status")
  noRes.setAttribute("aria-live","polite")
  noRes.textContent="No results found"
  list.appendChild(noRes)
  function toggle(){
    var open=list.style.display==="block"
    list.style.display=open?"none":"block"
    btn.textContent=open?"Expand":"Collapse"
    arrow.textContent=open?"▸":"▾"
    if(!open){
      search.style.display="block"
      input.value=""
      filter("")
      if(window.__openSection && typeof window.__openSection==="function"){ window.__openSection() }
      window.__openSection=function(){ input.value=""; filter("") }
      input.focus()
    }
  }
  header.addEventListener("click",toggle)
  btn.addEventListener("click",function(e){e.stopPropagation();toggle()})
  section.appendChild(header)
  section.appendChild(list)
  function filter(q){
    loading.style.display="block"
    var any=false
    for(var i=0;i<rows.length;i++){
      var r=rows[i]
      var show=matchesQuery(r.text,q)
      r.el.style.display=show?"flex":"none"
      if(show) any=true
    }
    noRes.style.display=any?"none":"block"
    loading.style.display="none"
  }
  var raf=null
  function onInput(){
    if(raf) cancelAnimationFrame(raf)
    raf=requestAnimationFrame(function(){ filter(input.value) })
  }
  input.addEventListener("input",onInput)
  input.addEventListener("keydown",function(e){
    if(e.key==="Enter"){ e.preventDefault(); filter(input.value) }
    else if(e.key==="Escape"){ e.preventDefault(); input.value=""; filter("") }
  })
  btnSearch.addEventListener("click",function(){ filter(input.value) })
  btnClear.addEventListener("click",function(){ input.value=""; filter(""); input.focus() })
  return section
}
function matchesQuery(text,query){
  var t=(text||"").toLowerCase(), q=(query||"").toLowerCase()
  if(!q) return true
  return t.indexOf(q)!==-1
}
function runSearchTests(){
  var cases=[
    {t:"Pointercrate Demon List", q:"pointer", expect:true},
    {t:"Pointercrate Demon List", q:"crate", expect:true},
    {t:"Shitty List", q:"shitty", expect:true},
    {t:"Insane Demon List", q:"insane", expect:true},
    {t:"Mobile Challenge List", q:"desktop", expect:false},
    {t:"", q:"anything", expect:false},
    {t:"Nine Circles", q:"nine circles", expect:true}
  ]
  var pass=0
  for(var i=0;i<cases.length;i++){
    var c=cases[i]
    if(matchesQuery(c.t,c.q)===c.expect) pass++
  }
  var info=document.createElement("div")
  info.className="footnote"
  document.querySelector(".container").appendChild(info)
}
document.addEventListener("DOMContentLoaded",function(){
  var rawText=
`other hubs:

Top 1s List: https://docs.google.com/document/d/1UCcy5520cQs2PA4eTjyfOLSBXqe6ADIoeHwQXjb5Dhg/edit
Bottom 1s List: https://docs.google.com/document/d/1JjU5IhAaayKfInc8iCGGnlJZ566Y92b1TkdsXDOIK4/edit#
Density List: https://docs.google.com/spreadsheets/d/1WMosrsAabL0F7_k8j-nMaYX_XF_Cpd5GVy9Lq8gurvI/edit#gid=0

---

lists that have their own website/google site:

Pointercrate: https://pointercrate.com/demonlist
Challenge List: https://challengelist.gd
Impossible Levels List: https://impossiblelevels.com
Shitty List: https://tsl.pages.dev/
Insane Demon List: https://insanedemonlist.com/
Low Refresh Rate Demon List: https://gdlrrlist.com
1.9 GDPS Demon List: https://pointercrate.xyze.dev/demonlist
Layout List: https://laylist.pages.dev/#/
Malaysian Challenge List: https://sites.google.com/view/malaysiachallengelist/home
Invisible List: https://sites.google.com/view/invisible-list/list
Wall Store Challenge Lis: https://www.wallstorechallengelist.com
Decode Demon List: https://sites.google.com/view/decodedemonslist/home
VPS Demon List: https://sites.google.com/view/vpsdemonlistv2/home
WGDPS Demon List: https://worstgdpsdemonlist.jecool.net
Shitty Challenge List: https://scl.pages.dev/
CnekGDPS Demon List: https://sites.google.com/view/cnekgdps/demons-list
TGDPS Demon List: https://tgdps-dl.pages.dev/#/
Hard Demon List: https://hdl.pages.dev/#/
Peaceful Demon List: https://dpoopoop.wixstudio.com/peacefullist
Mobile Demon List: http://gdmobilelist.com
High Refresh Rate Mobile Demon List: https://mobilepointercrate.com/
Exus Demon List: https://sites.google.com/view/gd-exus-demon-list/top-10
CobGDPS Demon List: https://sites.google.com/view/cobgdpsdemonlist/home
All Rated Extreme Demon List: https://aredl.pages.dev/#/
Two Player Levels List: https://2plist.github.io/2plist/#/
1.0 GDPS Demon List: https://10gdps.pages.dev/#/
Global Demon List: https://demonlist.org/
Mobile Challenge List: https://sites.google.com/view/mobile-challenge-list/home
GD Platformer List: https://gdplatformerlist.com
Pemonlist: https://pemonlist.com
All Rated Extreme Demons List: https://aredl.net
Challenge List: https://challengelist.gd/challenges/
Easy Demon List: https://easydemonlist.pages.dev/#/
Geometry Dash Demon Ladder: https://gdladder.com
Geometry Dash Demon Progression List: gddp.pro
Global Demonlist: https://demonlist.org
Hard Demon List: hdl.pages.dev
Hardest Impossible Levels List: https://impossiblelevels.com
Insane Demon List: https://insanedemonlist.com
Low Refresh Rate Demon List: https://gdlrrlist.com
Medium Demon List: https://tmdl.pages.dev/#/
Most Useful GD Levels: https://gdcolon.com/usefulgdlevels/
Nine Circles Demonlist: https://www.ninecirclesdemonlist.com
Pointercrate: https://pointercrate.com
Shitty List: https://tsl.pages.dev
Shitty list Plus: https://tslplus.pages.dev/#/
Two Player List: https://2plist.github.io/2plist/#/list
Unrated Demons List: https://udl.pages.dev/#/

---

docs:

Old Silent Levels List: https://docs.google.com/document/d/1hINX9s9FrIUsxBBCE8SKDnijq0v8krU6Qe3KoGrGBg0
Physically Possible Levels List: https://docs.google.com/document/d/1RZ524Gsou0w4djb3I13vvYV6Q9pp77UjlJkS_Et8b28/edit#heading=h.b5upf53xta3v
Theoretically Possible Levels List: https://docs.google.com/document/d/1GvNWez3Vh3Q6AQXLshYOmA3sXG-9JbV6Zf7ZzRpba0o
Spam Challenge List: https://docs.google.com/document/d/14GxSsA_mYh9dsYajiXGLBSfP1Vv3YfOjT2kLXRz1PZg/edit?usp=sharing
Physically Impossible Levels List: https://docs.google.com/document/d/1IMhpyQvOBcDovqXNXUcCXQ1yolbP-UHruV5kx1OzZ00/edit?usp=sharing
Hardest Harders List: https://docs.google.com/document/d/1RkTmKeFskCuP1fWaPvdE_gZGEoF6rWvpR8wKNMmwzfw/edit
Hardest Insanes List: https://docs.google.com/document/d/1gmiXVzLi_eAQrqiLuIj7r3Dka_sxJpjj87iuweYa2-A/edit
Old Impossible Challenge List: https://docs.google.com/document/d/1LoI4Lunbcr6FRm_S3IrdTtJJQu49LExlRccPTYVXx_c
Silent Challenge List: https://docs.google.com/document/d/1BTBVXllpdpatOcO8Dgpdg3TO9LpOgyR9RKcWU1syLo4/edit?usp=sharing
Speed-hack Demon List: https://docs.google.com/document/d/1sXM9JT_l4-mujkT0dHQzQ0rSPe9OptqAs78r8NDm0OQ/edit#heading=h.aqyn5madqczi
New Silent Levels List: https://docs.google.com/document/d/1R-w-JVoRrD8AyNpmdwY0mbJT0K0jN2DaCFx7AfZ7reA/edit?usp=sharing
Shitty Impossible Levels List: https://docs.google.com/document/d/19GxSrSaoNnIUClrUmQPaFWVCnfVeUPjUqji9C1bFBX0/edit?usp=sharing
Buffed Levels List: https://docs.google.com/document/d/1zQ8xQ-EMft0pChKNbHaetMd5QtbnPeDjO7YW4ZMtOPc/edit?usp=sharing
VPS Impossible Levels List:https://docs.google.com/document/d/1NO3RvuYarewsCVTGd1s7s9hn3bOphwfq4pE3SziWZbc/edit
WGDPS Impossible Levels List: https://docs.google.com/document/d/1bajbwlHOT9OtHjjsT8pCQH5FsD5lQ-uhkRmoILbMwcc/edit?usp=sharing
WGDPS Silent Levels List: https://docs.google.com/document/d/1KoJEZyn7YCSufKoj24ARzqPTnE4dBO6YjQ4thlGJ4kw/edit?usp=sharing
Russian Impossible Levels List: https://docs.google.com/document/d/1OwEp6fX-qoabpMeUOxHRtUqQhT0qpQqCOWVVkRApSSk/edit
Alternate Physically Impossible Challenge List: https://docs.google.com/document/d/19Lqzx5ErHK63vkR_z8U2XFyHJf_kkyDgdH3T-N253FE/edit#
CnekGDPS Challenge List: https://docs.google.com/document/d/1wULC6VBbBzMWXVFqXKhlygIxbVRHVpY7xJ9dohDuzaY/edit
CnekGDPS Impossible Levels List: https://docs.google.com/document/d/1CsJCDIJV7DZUcH83AuoAJLucp8cyF_ga60Hc92UGdUE/edit
Easy Demon List: https://docs.google.com/document/d/14n3gVDIq7A5uBQ4xJpnjFNmaz2Bxgbzq60MfhmgKlCw/edit?usp=sharing
Silent Impossible Levels List: https://docs.google.com/document/d/e/2PACX-1vT0sq6MXopf2Quc3Kp6gPQfn9lhvvsC63V973XreCHaJEYfAcfz9ReQX28AFOOmmuo55Mq9W_fbytH6/pub
Unbalanced Levels List: https://docs.google.com/document/d/1B7OefrOpKcWWKGAal4loDyRFuOiXVFf4r_OjOj6BFvw/edit?usp=drivesdk
Ballistic Levels List: https://docs.google.com/document/d/19qibumS80Rvh04SSicDJQpfLh3cWQxGtAKPPSv78D38/edit?usp=drivesdk
Theoretically Impossible Levels List: https://docs.google.com/document/d/1Lelz4d9ZiynRoeL-R23Cug2BqouVKxdE/edit
Poopy Head Impossible List: https://docs.google.com/document/d/10oP6lOXwnOCaPNdu5nkv8MK9epjJsL_D-gBh-GyXpo0/edit?usp=sharing
Imposiblum Server Levels List: https://docs.google.com/document/d/1AcTLeORZnK9PXUCWBtBdQKc3sSp452xOu21VhhiisUU/edit?usp=drivesdk
Anarquic Levels List: https://docs.google.com/document/d/1Sc6fJSoYR0C6bWJgRPigZI3jMZcCBSjnO_Bd52KZm1s/edit?usp=drivesdk
Impossible Challenge List Rebirth: https://docs.google.com/document/d/1Gc8_cgoNjN92m0QqdI2popyIPOpCH2UQZ6aCpNUpAg4/edit?usp=drivesdk
Empanada Challenge List: https://docs.google.com/document/d/10Z-e9Yip3YC8t9RjgB0L_Kme9WxaXsH4Dvmks-PnFeU/edit
Nine Circles Levels List: https://docs.google.com/document/d/1IOcB3EkUeetoynf2V2ly4RsTJUBJKokGyQ6CdvU1Az0/edit
Longest Levels List: https://docs.google.com/document/d/1_mXaamz1IyVAY30M9Abi70-eqYD17WJjNWq1wDGkXTQ/edit?usp=drivesdk
Hardest 2.1 GDPS Levels: https://docs.google.com/document/d/1MBff2DxAe_Tl7jj7XizcvdamC3wAEbbK823M5Ngev5k/edit?usp=sharing
Blueyjay Challenge List: https://docs.google.com/document/d/1BgIcB0LV9ARg46GceJgSaa53xWVAc-Jr9KatMUIzsAw/edit?usp=drivesdk
General Impossible Levels List: https://docs.google.com/document/d/1-63wFxJ3lQFe6A0XYyy11qgyhu0E3JHd60LnzXVYrz0/edit
Low Death Levels List: https://docs.google.com/document/d/1BOBzoWHowe-tNx79LUetvSb8-RKAlFgr_4nyBBU8FOM/edit?usp=sharing
Endpoint Demon Levels List: https://docs.google.com/document/d/176_hswJzllR_cBbKdNHeT8XALr2KAME05yHkBUsnYls/edit
Completely Crap Levels List: https://docs.google.com/document/d/1ng75ZVe450GOe68pCdVI2r0820NKsMbe5I4o_Iyzst0/edit?usp=sharing
Factory Levels List: https://docs.google.com/document/d/1vh1fheWJWLZS_sr3B3xj88cNtjmwRSwHXgY93mwZ0Do/edit
Top 1s List: https://docs.google.com/document/d/1UCcy5520cQs2PA4eTjyfOLSBXqe6ADIoeHwQXjb5Dhg/edit
Bottom 1s List: https://docs.google.com/document/d/1JjU5IhAaayKfInc8iCGGnlJZ566Y92b1TkdsXDOIK4Q/edit#
Humanly Impossible Levels List: https://docs.google.com/document/d/1-XKwoHR_0mGgZ7POp1yuf7UkjSvhg0QzXo1TMZT-iGA/edit
Winerecia Demon List: https://docs.google.com/document/d/1V_P1x44KPywanXwmE0AxO-cfQGz8zXJECYHE_7KK7wY/edit
Winerecia Challenge List: https://docs.google.com/document/d/1GZopT4fmjxf7qwfqy9SwNAlXs7Siz2Bm5aSGpVPjbQ4/edit
Winerecia Impossible Levels List: https://docs.google.com/document/d/1BqZmyjIRvU1uOYCIo_lZuEY2jcGHVJHCX6RQP2RjmDI/edit?usp=drivesdk
Winerecia Silent Levels List: https://docs.google.com/document/d/1nAtx-hemWUXsC-CIRbs9Q3PjljvBJwtuH9FBVGvma6c/edit?usp=drivesdk
Winerecia Impossible Challenge List: https://docs.google.com/document/d/1icNdtnSJeQCweZCMiqvzp_5e7nwO_HlFu3NQKP2u-P0/edit?usp=drivesdk
Winerecia Silent Challenge List: https://docs.google.com/document/d/1M97dWtECl3OpexjYJ3Ld0SZSN-AhvD1sjTxr08abH7o/edit?usp=drivesdk
Tower Sequels Levels List: https://docs.google.com/document/d/1V4_kNzsoV_x8tErSLo_nPhGhViv41mj1cEtceomWRkg/edit?usp=drivesdk
Physically Impossible Levels List: https://docs.google.com/document/d/1aXE2lMXo-APKFfv78hFfaIz0kVVgle8KBsQRDn5Ucz8/edit
Main Levels List: https://docs.google.com/document/d/1NTyf_ZedVKZzoDHZGJ4djabiTFTXo2MjZMvVVk5ozhM/edit
Anarchy Levels List: https://docs.google.com/document/d/147mwHuvuwvxV3tAUzhkj-QO-FHypPn1_hRLhF6dpppg/edit?usp=sharing
15fps Challenge List: https://docs.google.com/document/d/1MjZtIlBagV7pKsqyAJTzZjn0j4h6hyuvg-U1YKar1Vw/edit
Low Quality Levels List: https://docs.google.com/document/d/1gzxPPLMBsVlQx13wvThM_lhajb2tBoVUEoc2Qu1ksgo/edit
Low Object Levels List: https://docs.google.com/document/d/1Ftf77s3ml7q7pm6RksXMiqYuwf5Afak5cDixxDYb5R0/edit?usp=sharing
Super Buffed Challenge List: https://docs.google.com/document/d/10HM41aKQJiYdyMlsoG-0dKC3hnfHZW2_33e4jQpREgE/edit
Shortest Demon List: https://docs.google.com/document/d/1NB9hJdMFO5ueergUgUF-SM-0c1f9evr92EWcPcWVpTI/edit
Random Levels List: https://docs.google.com/document/d/1WqHKVRS5Qpg-dKBBAcNusNsNY3iZ34l_kQsqTfPvxnM/edit
Impossible Rejects List: https://docs.google.com/document/d/17jgfK3_STnsR9lHp8hH5LXHoIONAlL52YfkA-bpXkm8/edit
Theoretically Possible Gameplay List: https://docs.google.com/document/d/1C5bw82VJxnrITiX1OwdE51ftp4nFqHitixWbx9qHe8c/edit?usp=sharing
Quick Challenge List: https://docs.google.com/document/d/1DgxIFcUWw1m6i3ujQurVGwDruzU4cyQtmVcdWJa3-Pg/edit?usp=sharing
Old Impossible Levels List: https://docs.google.com/document/d/1VAbKf9-R9ptbcxJwetj1kRUYf0zNQCiVDqSedwOxEaA/edit
Nine Circles Demon List: https://docs.google.com/document/d/1rZnRgRjoFQAmJX9PsAJ2oWxnC7SsP-Rf8CUnLsBR8dY/edit
Hardest Never Clear Levels List: https://docs.google.com/document/d/1zcYlXdOrReEuYH7iLqiiRHf0JOTuumUs2d8Da9ETlLY/edit?usp=drivesdk
Sloomiest Impossible Levels List: https://docs.google.com/document/d/1C8nhnsTsokVXm33_1yBj560A-TbZh2UL-cwgeZLlvFU/edit
Stereo Madness Rebirth Levels List: https://docs.google.com/document/d/1r2jYGeeeoB8YNV1g90WnxEgH2zANcNws-lGkHHMq4wg/edit
Upcoming Levels List: https://docs.google.com/document/d/1WYGvQgdnVduQNvSOu5tC0tqK7rl9rOOi8126koSYYyY/edit
Nine Circles Levels List: https://docs.google.com/document/d/1t2Uw6uWZkr3FeUQBwQfhKrYEGYIPUaIoFwMHgt5Je6o/mobilebasic
Free Levels List: https://docs.google.com/document/d/1TPKOPIh2xSucEYUxbUbBkoKI8oCm5mGHt1ikRpMhLls/edit#heading=h.jkawdwmw3f0f
Meaningless Levels List: https://docs.google.com/document/d/1HyYsFpctrTd4PrtsgfuYJUTlTmv6pwYEoUKDtiYX6OA/edit?usp=drivesdk
Anarchist Levels List: https://docs.google.com/document/d/1l1sKvQKWXX0uq5i_g5EuBX2OoBqj_9uXSorSIqAWXig/edit?usp=sharing
Silent Levels List Remastered: https://docs.google.com/document/d/1MfNXY3fBSYmHFu-zayZtGEx403iXvDROfiXkY9ChM0k/edit?usp=sharing
Mobile Impossible Demon List: https://docs.google.com/document/d/1-mJttgCKmIk88Zf2ql0fmAOjT_DpuloUN6q0UzRbie4/edit?usp=drivesdk
Easiest Levels List: https://docs.google.com/document/d/1k098cQw4GMR8B-cWRLvUJy4Qc5fhNHaT6KOxTi1mFYo/edit#heading=h.2uu20crj0mkt
One Attemptable Levels List: https://docs.google.com/document/d/1j0oSec7qwBdDEqGxuVX36nK6EcHO4ct3L5uLG7F9Rnc/edit#heading=h.1gaemhh3lmvv
Easiest Demon List: https://docs.google.com/document/d/1Dku0LmU8n90BXE1jXMMY5-fNb9J3zHA9dYisMkbX3QM/edit
Possible Levels List: https://docs.google.com/document/d/1nHKKNBxAiuqTSuPcs7NmAgDj1c59Bb4YKSuKZfC-Z9k/edit
Levels Harder Than Tartarus List: https://docs.google.com/document/d/1W8Hfa3x2HAbps11j_TBz2fqye32Tsulik8kNkMgnhAY/edit
Infinite Clicks Levels List: https://docs.google.com/document/d/1qtpmJHj_ftWs0SHfG5nwnaoEJgyplzHWaiI33pldjyg/edit
Silent Levels List: https://docs.google.com/document/d/1E9Pdj_RRx2zsuno-SSORiYPcQvzVFEE5LhTdEUS8vic/edit?usp=sharing

spreadsheets:

SilvrPS Demon List: https://docs.google.com/spreadsheets/d/1MXzrX1yR0BMOB6-n14cbhHaa1HdNIGrJMPQeF4pgonk/edit?usp=sharing
Roti Canai List: https://docs.google.com/spreadsheets/d/1HVFVkXomAfUmaqtBX37y9iVf7BQKc-xDDNh-MQtTLU8/edit?usp=sharing
Rendang Rusa List: https://docs.google.com/spreadsheets/d/1oTZb9wWcjNmnDB2_QQPqGcfs4hJjR1Ljc6wv5baN8iM/edit#gid=301347713
Cube Challenge List: https://docs.google.com/spreadsheets/d/1RkdoNx0mBoALhK8fFIlS6SFBM0C6wKYkgWRArCKD_28/edit?usp=sharing
GD Cube Skill Ranking: https://docs.google.com/spreadsheets/d/1RkdoNx0mBoALhK8fFIlS6SFBM0C6wKYkgWRArCKD_28/edit?usp=sharing
Miscellaneous List: https://docs.google.com/spreadsheets/d/1RkdoNx0mBoALhK8fFIlS6SFBM0C6wKYkgWRArCKD_28/edit?usp=sharing
WGDPS Coins List: https://docs.google.com/spreadsheets/d/1jEtuou6u7a8kR80uuucfylg7WDmULZPBJcA11ev7qpI/edit?usp=sharing
Speed-up Levels List: https://docs.google.com/spreadsheets/d/1PNWis8tMx8g2BN6EgQLOm2V0MpOVvyk4TGwbX4w-JfI/edit?usp=sharing
1 Second Challenge List: https://docs.google.com/spreadsheets/d/1JCMOJ--1-OdKM9GdG-qlVAazgGeRAZny-0OQ4KJNuyM/edit#gid=0
Oldest Silent Levels List: https://docs.google.com/spreadsheets/d/1q6u0elsSk7cLQ0oX0Qh44lbqE2mOB-QibDJCjZ7ldD0/edit#gid=2102622344
Plank List: https://docs.google.com/spreadsheets/d/1d2DFhZJ0y3Dt85wcPPxgFgu3-EfEfjHgXWI78zvzLqE/edit#gid=0
Private Demon List: https://docs.google.com/spreadsheets/d/14rb3SsfrZ5nSRigs8XFmYL1VRNce8QA4dOeeLkb1GXU/edit#gid=1539115923
Private Challenge List: https://docs.google.com/spreadsheets/d/14rb3SsfrZ5nSRigs8XFmYL1VRNce8QA4dOeeLkb1GXU/edit#gid=1539115923
User Coins List: https://docs.google.com/spreadsheets/d/1tmD4tonWciYLxNYveX-ceSgIWyqZkiMolLPZF6sFXjQ/edit#gid=0
Funny Challenge List: https://docs.google.com/spreadsheets/d/1v9HAvsUQAczmfXkzPt90JUwNjbce1_oC_wPD2Kc5eHk/edit#gid=0
Memory Demon List: https://docs.google.com/spreadsheets/d/1yMhoHeQnkxsRSPU8sf8iFg01_sqd3M17mNUkjM4YeHE/edit#gid=1029834530
Mirror Portal Demon List: https://docs.google.com/spreadsheets/d/1e2GgkRzI8AqrU-F-9TsGHKcQvtnOCWeq5hSSFRznlU0/edit?usp=drivesdk

---

lists that (only) exists in a discord server:

Medium Demon List: https://discord.gg/CwjaCCZvsX
Hardest Hards List: https://discord.gg/7evYpZfxpj
Crappy Levels List: https://discord.gg/eUMfjx3KKS
2.0 GDPS Demon List: https://discord.gg/AZ9k57wGZB
Silent Joke Levels List: https://discord.gg/Hg77bG6CYA
Hardest Normals List: https://discord.com/invite/BaNYGTg

---

Backups of existing lists (actually intended to be a backup):

Challenge List(Backup): https://docs.google.com/document/d/19Trm1wgo2NvKIy2faOYsUmVRgU-_NBUC8m3mcBv7J_E/edit?usp=sharing
Unrated Demon List:(Bakcup): https://docs.google.com/document/d/11PpTKKK_-meIr1tLkkgupeoUb01X6_B4eGP28-BcX4/edit?usp=sharing

---

Lists that are discontinued/not working right now:

Unrated Demon List: https://udl0.pages.dev/#/
Fun Challenge List: https://fcl.leywin7799.repl.co/
Sus Challenge List: https://suschallengelist.krisgra.repl.co
VPS Challenge List: https://vpschallengelist.pages.dev/#/
WGDPS Challenge List: https://worst-gdps-challenge-list.pandaaaaaaa.repl.co/
TGDPS Challenge List: https://tgdpschallengelist.googletom301.repl.co/
Gaym 11 Demon List: https://demonlist.gaym11.repl.co/index.html
Gaym 11 Challenge List: https://demonlist.gaym11.repl.co/challenge.html
Hell Challenge List: https://sites.google.com/view/thehellchallengelist/home
Classic Levels List: https://classic-levels-list.plastornious.repl.co/
Consistency Challenge List: https://docs.google.com/document/d/1P_hbwCbYUIjovxaRINMaprLM_J9gKRRlj01Md8Oaqn4/edit?usp=sharing
R-word Levels List: https://docs.google.com/document/d/1fIP7zphu27BkPvySMY3kPvzwWQp0bZ11XY6IukrwtbM/edit?usp=sharing
Shitty Spam Challenge List: https://docs.google.com/document/d/15rsgKFxswfnzDs7aZX6UiI6oJ7LaYjuiAcjO8BmnUr4/edit?usp=drivesdk
Russian Impossible Challenge List: https://docs.google.com/document/d/16izI2wnKCkOcR8ezShH7jN4WVj9pL-SmuwNtNAUyydI/edit
Alternate Physically Impossible Levels List: https://docs.google.com/document/d/1ueSnMMShjnyEnK689xpJlkSbTpdJyEla2OgMgkhqYac/edit?usp=drivesdk
Hardest Levels to Bot List: https://docs.google.com/document/d/121ZswafJ4sBqxDKO_pqoyI3ZlNpC_Xqvc7MBTk9VwnI/edit?usp=sharing
Impossible Levels to Bot List: https://docs.google.com/document/d/121ZswafJ4sBqxDKO_pqoyI3ZlNpC_Xqvc7MBTk9VwnI/edit?usp=sharing
Low Standard Extreme Demon List: https://docs.google.com/document/d/12bG8vA-RJLTahR_ajfaLnaUoEzU7kLENBCtzFWzmmsI/edit
Special Counter Levels List: https://docs.google.com/document/d/1ssqJGOuvTPjzdIehEeSgfsHx6gU0vRJyBlv2JG9tu9E/edit?usp=drivesdk
Counter Levels List: https://docs.google.com/document/d/1ssqJGOuvTPjzdIehEeSgfsHx6gU0vRJyBlv2JG9tu9E/edit?usp=drivesdk
Physically Impossible Challenge List: https://docs.google.com/document/d/1qJXyDejZ4xeuCO_9c-jCrloCk0Md7Tj_aGDa3SkmPPQ/edit
New Impossible Challenge List: https://docs.google.com/document/d/1iAUIZZ2gPm4KZM-tHgJ-E5eLGWaol7ouxFtNkbmqaaY/edit
Jessie's Hardest Levels List: https://docs.google.com/document/d/1M5uupreyNDeMtirL_6v6aNke9EcD5a0BgTthcIyf374/edit?usp=sharing
Mefistic Challenge List: https://docs.google.com/document/d/159mD9ThYPJuMXBvYcEirTe0f9VLwgN8CYMUwQVRhqsQ/edit
Hardest Levels List: https://docs.google.com/document/d/1rWvdS52WdOs61kkASC4F1IQlMSJmLiVvI93516GUpkA/edit
Hypothetically Impossible Levels List: https://docs.google.com/document/d/1B15K_h_zjAKNFZ-QIBCDFxnyWyB_eiOhkZq1sCz44kU/edit
Impossible Challenge List: https://docs.google.com/document/d/1iAUIZZ2gPm4KZM-tHgJ-E5eLGWaol7ouxFtNkbmqaaY/edit?usp=drivesdk
Worst Levels List: https://docs.google.com/document/d/1Uk_fPXA9LJoSq-77518xepsINStXm6fG8-9PGNXd6m0/edit
XGDPS Demon List: https://discord.gg/ZnAeAsFhJb
CatstiksGDPS Demon List: https://discord.gg/wu8Hh9kb9G
CatstiksGDPS Challenge List: https://discord.gg/wu8Hh9kb9G

---

if you know that there is any updated version of any list that you know or you want new list to be added here tell me about it here purpurrr13#0000 or droxyt518@gmail.com`
  var cats=parse(rawText)
  cats=dedupe(cats)
  var order=["level1","level2","level3_docs","level3_sheets","no_discord","no_backup","level4"]
  var root=document.getElementById("sections")
  order.forEach(function(id){
    root.appendChild(makeSection(id,cats[id]))
  })
  runSearchTests()
})
