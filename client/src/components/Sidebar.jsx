import React from 'react';
const menus={
 STUDENT:[['overview','Overview','⌂'],['attendance','Attendance','◷'],['marks','Results','▤'],['timetable','Timetable','▦'],['notices','Notices','◉'],['fees','Fee account','₹'],['courses','My courses','◇'],['reports','My reports','↗'],['profile','Profile','○']],
 TEACHER:[['overview','Overview','⌂'],['attendance','Attendance','◷'],['marks','Marks entry','▤'],['timetable','Timetable','▦'],['notices','Notices','◉'],['courses','My classes','◇'],['reports','Class reports','↗'],['profile','Profile','○']],
 HOD:[['overview','Overview','⌂'],['attendance','Attendance','◷'],['marks','Marks approval','▤'],['timetable','Timetable','▦'],['notices','Notices','◉'],['courses','Department','◇'],['reports','Department reports','↗'],['profile','Profile','○']],
 ADMIN:[['overview','Overview','⌂'],['attendance','Attendance','◷'],['marks','Marks','▤'],['timetable','Timetable','▦'],['notices','Notices','◉'],['fees','Fee management','₹'],['courses','Academics','◇'],['reports','Reports & audit','↗'],['users','Users','◎'],['profile','Profile','○']],
};
export default function Sidebar({user,page,setPage,onLogout,open,setOpen}){
 const role=user.role;const name=user.profile?.name||user.loginId;return <><button className="mobile-menu" onClick={()=>setOpen(!open)} aria-label="Toggle navigation">☰</button>{open&&<button className="mobile-scrim" onClick={()=>setOpen(false)} aria-label="Close navigation"/>}<aside className={`sidebar ${open?'sidebar-open':''}`}>
  <div className="brand"><div className="brand-mark">C<span>.</span></div><div><strong>campus<span>desk</span></strong><small>COLLEGE ERP PORTAL</small></div></div>
  <div className="campus-select"><span className="campus-dot"/><div><strong>Central Campus</strong><small>Academic year 2026–27</small></div><span className="chevron">⌄</span></div>
  <div className="menu-caption">WORKSPACE</div><nav>{(menus[role]||menus.STUDENT).map(([id,label,icon])=><button key={id} className={`nav-item ${page===id?'nav-active':''}`} onClick={()=>{setPage(id);setOpen(false);}}><span className="nav-icon">{icon}</span>{label}{id==='notices'&&<span className="nav-dot"/>}</button>)}</nav>
  <div className="sidebar-bottom"><div className="help-card"><span className="help-icon">✳</span><strong>Need a hand?</strong><p>Our campus team is here to help you.</p><button onClick={()=>setPage('notices')}>View announcements <span>→</span></button></div><div className="user-mini"><div className="avatar">{name.charAt(0)}</div><div className="user-mini-copy"><strong>{name}</strong><small>{role==='HOD'?'Department head':role[0]+role.slice(1).toLowerCase()}</small></div><button className="logout-button" onClick={onLogout} title="Sign out">↗</button></div></div>
 </aside></>;
}
