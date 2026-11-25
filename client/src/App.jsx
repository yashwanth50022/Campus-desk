import React,{useCallback,useEffect,useState} from 'react';
import {api} from './lib/api.js';
import Sidebar from './components/Sidebar.jsx';
import Topbar from './components/Topbar.jsx';
import {Loading} from './components/Primitives.jsx';
import Login from './pages/Login.jsx';
import Dashboard from './pages/Dashboard.jsx';
import Attendance from './pages/Attendance.jsx';
import Marks from './pages/Marks.jsx';
import Timetable from './pages/Timetable.jsx';
import Notices from './pages/Notices.jsx';
import Fees from './pages/Fees.jsx';
import Courses from './pages/Courses.jsx';
import Reports from './pages/Reports.jsx';
import Users from './pages/Users.jsx';
import Profile from './pages/Profile.jsx';
import FirstLogin from './pages/FirstLogin.jsx';

export default function App(){
 const [user,setUser]=useState(null);const [page,setPage]=useState('overview');const [loading,setLoading]=useState(true);const [mobileOpen,setMobileOpen]=useState(false);const [notice,setNotice]=useState('');
 const refresh=useCallback(async()=>{try{const result=await api.get('/auth/me');setUser(result.user);}catch{setUser(null);}finally{setLoading(false);}},[]);
 useEffect(()=>{refresh();},[refresh]);
 useEffect(()=>{if(!notice)return;const t=setTimeout(()=>setNotice(''),3600);return()=>clearTimeout(t);},[notice]);
 async function logout(){try{await api.post('/auth/logout',{});}finally{setUser(null);setPage('overview');}}
 if(loading)return <Loading/>;
 if(!user)return <Login onLogin={async()=>{await refresh();}}/>;
 if(user.forcePasswordChange)return <FirstLogin user={user} onComplete={async()=>{await refresh();setPage('overview');}} onLogout={logout}/>;
 
 const titles={overview:'A better day starts here.',attendance:'Attendance, at a glance.',marks:'Every effort has a record.',timetable:'Your week, in rhythm.',notices:'What’s happening on campus.',fees:'Your finances, made clear.',courses:'Learning is a shared journey.',reports:'The details behind the day.',users:'Your campus community.',profile:'A little about you.'};
 const props={user,onToast:setNotice};let content;
 switch(page){case'overview':content=<Dashboard {...props} setPage={setPage}/>;break;case'attendance':content=<Attendance {...props}/>;break;case'marks':content=<Marks {...props}/>;break;case'timetable':content=<Timetable {...props}/>;break;case'notices':content=<Notices {...props}/>;break;case'fees':content=<Fees {...props}/>;break;case'courses':content=<Courses {...props}/>;break;case'reports':content=<Reports {...props}/>;break;case'users':content=<Users {...props}/>;break;case'profile':content=<Profile {...props} onUser={setUser}/>;break;default:content=<Dashboard {...props} setPage={setPage}/>;}
 const today=new Date();const dayLabel=new Intl.DateTimeFormat('en',{weekday:'long'}).format(today).toUpperCase();const termLabel=user.profile?.semester?`SEMESTER ${user.profile.semester}`:`ACADEMIC YEAR ${today.getFullYear()}–${String(today.getFullYear()+1).slice(-2)}`;
 return <div className="app-shell"><Sidebar user={user} page={page} setPage={setPage} onLogout={logout} open={mobileOpen} setOpen={setMobileOpen}/><main className="main-shell"><Topbar page={page} user={user} onNotifications={()=>setPage('notices')}/><div className="page-content"><div className="welcome-row"><div><div className="eyebrow"><span className="live-dot"/> YOUR CAMPUS, IN SYNC</div><h1>{titles[page]}</h1><p className="welcome-sub">{user.profile?.name?`Welcome back, ${user.profile.name.split(' ')[0]}. Here’s what’s happening today.`:'Welcome to your college workspace.'}</p></div><div className="welcome-date"><span>✳</span><div><strong>{new Intl.DateTimeFormat('en',{month:'long',day:'numeric'}).format(today)}</strong><small>{dayLabel} · {termLabel}</small></div></div></div>{content}</div><footer className="footer"><span>© 2026 Campus Desk</span><span>Built for your campus <b>✳</b></span></footer></main>{notice&&<div role="status" className="toast">{notice}</div>}</div>;
}
