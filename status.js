/* Live open/closed status for store cards. Times are Baytown (America/Chicago). */
(function(){
  var HOURS={0:null,1:[390,1140],2:[390,1140],3:[390,1140],4:[390,1140],5:[390,1140],6:[480,1020]}; /* minutes from midnight; Sun closed */
  var CLOSED_DATES=[]; /* holiday closures, format 'YYYY-MM-DD', e.g. '2026-12-25' */
  var DAYS=['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
  function fmt(m){var h=Math.floor(m/60),mi=m%60,ap=h>=12?'pm':'am';h=h%12||12;return h+(mi?':'+('0'+mi).slice(-2):':00')+ap;}
  function now(){
    var p=new Intl.DateTimeFormat('en-US',{timeZone:'America/Chicago',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hour12:false,weekday:'short'}).formatToParts(new Date()),o={};
    p.forEach(function(x){o[x.type]=x.value;});
    return {date:o.year+'-'+o.month+'-'+o.day,dow:DAYS.indexOf(o.weekday),min:(parseInt(o.hour,10)%24)*60+parseInt(o.minute,10)};
  }
  function ymd(add,n){var d=new Date(Date.UTC(+n.date.slice(0,4),+n.date.slice(5,7)-1,+n.date.slice(8,10)+add));return d.toISOString().slice(0,10);}
  function status(){
    var n=now(),h=HOURS[n.dow],isClosedDay=CLOSED_DATES.indexOf(n.date)>-1;
    if(h&&!isClosedDay){
      if(n.min>=h[0]&&n.min<h[1]){var left=h[1]-n.min;return {open:true,text:'Open now',sub:(left<=60?'Closing soon · ':'')+'Closes '+fmt(h[1])};}
      if(n.min<h[0])return {open:false,text:'Closed',sub:'Opens today at '+fmt(h[0])};
    }
    for(var i=1;i<=8;i++){
      var d=(n.dow+i)%7,hh=HOURS[d];
      if(hh&&CLOSED_DATES.indexOf(ymd(i,n))<0)return {open:false,text:'Closed',sub:'Opens '+(i===1?'tomorrow':DAYS[d])+' at '+fmt(hh[0])};
    }
    return {open:false,text:'Closed',sub:''};
  }
  function render(){
    var s=status();
    [].forEach.call(document.querySelectorAll('[data-open-status]'),function(el){
      el.className='ostat '+(s.open?'is-open':'is-closed');
      el.innerHTML='<span class="od" aria-hidden="true"></span><strong>'+s.text+'</strong>'+(s.sub?' <span class="os">· '+s.sub+'</span>':'');
    });
  }
  render();setInterval(render,60000);
})();
