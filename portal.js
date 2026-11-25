/* ------------------------------------------------------------------
   Campus Desk — portal
   Everything on screen comes from data.js. No build step, no server.
   Roles: STUDENT | TEACHER | HOD | ADMIN  (see GUIDE.md)
------------------------------------------------------------------ */
(function () {
  'use strict';

  var DATA = window.CAMPUS_DATA || {};
  var INSTITUTION = DATA.institution || {};
  var PEOPLE = Array.isArray(DATA.people) ? DATA.people : [];
  var COURSES = Array.isArray(DATA.courses) ? DATA.courses : [];
  var TIMETABLE = Array.isArray(DATA.timetable) ? DATA.timetable : [];
  var CALENDAR = Array.isArray(DATA.calendar) ? DATA.calendar : [];
  var SEED_NOTICES = Array.isArray(DATA.notices) ? DATA.notices : [];

  // Period start times (10:00–10:30 short break, 12:30–1:30 lunch)
  var PERIOD_START = { 1: '08:00', 2: '09:00', 3: '10:30', 4: '11:30', 5: '13:30', 6: '14:30', 7: '15:30' };
  var PERIOD_COUNT = 7;

  var ROLE_LABEL = { STUDENT: 'Student', TEACHER: 'Faculty', HOD: 'HOD', ADMIN: 'Administrator' };

  var NAV = {
    STUDENT: [['overview', '◫', 'Overview'], ['attendance', '◷', 'Attendance'], ['marks', '▤', 'Marks'], ['timetable', '▦', 'Timetable'], ['notices', '✉', 'Notices'], ['fees', '◇', 'Fees'], ['courses', '▥', 'Courses'], ['profile', '◎', 'Profile']],
    TEACHER: [['overview', '◫', 'Overview'], ['attendance', '◷', 'Attendance'], ['marks', '▤', 'Marks'], ['timetable', '▦', 'Timetable'], ['notices', '✉', 'Notices'], ['courses', '▥', 'Courses'], ['profile', '◎', 'Profile']],
    HOD: [['overview', '◫', 'Overview'], ['attendance', '◷', 'Attendance'], ['marks', '▤', 'Marks'], ['timetable', '▦', 'Timetable'], ['notices', '✉', 'Notices'], ['reports', '◍', 'Reports'], ['courses', '▥', 'Courses'], ['profile', '◎', 'Profile']],
    ADMIN: [['overview', '◫', 'Overview'], ['attendance', '◷', 'Attendance'], ['marks', '▤', 'Marks'], ['timetable', '▦', 'Timetable'], ['notices', '✉', 'Notices'], ['fees', '◇', 'Fees'], ['courses', '▥', 'Courses'], ['reports', '◍', 'Reports'], ['users', '☰', 'Users'], ['profile', '◎', 'Profile']]
  };

  var TITLES = {
    overview: 'A better day starts here.',
    attendance: 'Attendance, at a glance.',
    marks: 'Every effort has a record.',
    timetable: 'Your week, in rhythm.',
    notices: 'What’s happening on campus.',
    fees: 'Your finances, made clear.',
    courses: 'Learning is a shared journey.',
    reports: 'The details behind the day.',
    users: 'Your campus community.',
    profile: 'A little about you.'
  };

  var state = {
    signedIn: false,
    session: null,
    page: 'overview',
    menuOpen: false,
    toast: '',
    loginError: '',
    loginDraft: '',
    locked: false,
    attendanceDraft: {},
    marksDraft: {},
    notices: SEED_NOTICES.slice()
  };

  var toastTimer = null;

  /* ---------------------------------------------------------------
     Small helpers
  --------------------------------------------------------------- */
  function esc(value) {
    return String(value == null ? '' : value).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  }

  function money(amount) {
    return '₹' + Number(amount || 0).toLocaleString('en-IN');
  }

  function percent(present, total) {
    return Number(total) ? Math.round((Number(present) || 0) / Number(total) * 100) : 0;
  }

  function initialsOf(name) {
    return String(name || '?').split(' ').filter(function (part) {
      return part.length > 1;
    }).slice(0, 2).map(function (part) {
      return part.charAt(0);
    }).join('').toUpperCase() || '?';
  }

  function account() {
    return state.session;
  }

  function roleLabelOf(role) {
    return ROLE_LABEL[role] || role || 'Account';
  }

  function students() {
    return PEOPLE.filter(function (person) {
      return person.role === 'STUDENT';
    });
  }

  function subtitleOf(person) {
    if (!person) return '';
    if (person.role === 'STUDENT') {
      return [person.department, person.semester ? 'Semester ' + person.semester : '', person.section ? 'Section ' + person.section : '']
        .filter(Boolean).join(' · ');
    }
    return [person.designation, person.department].filter(Boolean).join(' · ');
  }

  function attendanceRate(person) {
    var attendance = person.attendance || {};
    return percent(attendance.present, attendance.total);
  }

  function subjectList(person) {
    return Array.isArray(person.subjects) ? person.subjects : [];
  }

  function feeList(person) {
    return Array.isArray(person.fees) ? person.fees : [];
  }

  function dueTotal(fees) {
    return fees.filter(function (fee) {
      return fee.status === 'DUE';
    }).reduce(function (sum, fee) {
      return sum + Number(fee.amount || 0);
    }, 0);
  }

  function markValue(person, component) {
    var draft = state.marksDraft[person.loginId + ':' + component];
    if (draft !== undefined) return draft;
    var marks = person.marks || {};
    return marks[component] === undefined || marks[component] === null ? '' : marks[component];
  }

  function hasAllMarks(person) {
    return ['IA1', 'IA2', 'SEE'].every(function (component) {
      return Number(markValue(person, component)) > 0;
    });
  }

  function todaySlots() {
    var day = new Date().getDay();
    if (day === 0) day = 1;
    var slots = TIMETABLE.filter(function (slot) {
      return slot.day === day;
    });
    return slots.length ? slots : TIMETABLE.slice(0, 0);
  }

  function termLine() {
    var semester = INSTITUTION.semester ? 'SEMESTER ' + INSTITUTION.semester : '';
    var year = INSTITUTION.academicYear ? 'ACADEMIC YEAR ' + INSTITUTION.academicYear : '';
    return [semester, year].filter(Boolean).join(' · ') || 'YOUR ACADEMIC TERM';
  }

  function collegeName() {
    return INSTITUTION.name || 'Your College';
  }

  function toast(message) {
    state.toast = message;
    render();
    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(function () {
      state.toast = '';
      render();
    }, 3400);
  }

  /* ---------------------------------------------------------------
     Building blocks
  --------------------------------------------------------------- */
  function stat(label, value, icon, delta) {
    return '<section class="card stat-card"><span class="stat-icon">' + icon + '</span><div>' +
      '<span class="stat-label">' + esc(label) + '</span>' +
      '<strong class="stat-value">' + esc(value) + '</strong>' +
      (delta ? '<span class="stat-delta">' + esc(delta) + '</span>' : '') +
      '</div></section>';
  }

  function table(columns, rows) {
    if (!rows.length) return '<div class="empty-state"><span>✦</span><p>No records to display.</p></div>';
    var head = columns.map(function (column) {
      return '<th scope="col">' + esc(column.label) + '</th>';
    }).join('');
    var body = rows.map(function (row) {
      return '<tr>' + columns.map(function (column) {
        return '<td>' + column.render(row) + '</td>';
      }).join('') + '</tr>';
    }).join('');
    return '<div class="table-wrap"><table><thead><tr>' + head + '</tr></thead><tbody>' + body + '</tbody></table></div>';
  }

  function sectionTitle(eyebrow, title, action) {
    return '<div class="section-title"><div>' + (eyebrow ? '<div class="eyebrow">' + esc(eyebrow) + '</div>' : '') +
      '<h2>' + esc(title) + '</h2></div>' + (action || '') + '</div>';
  }

  function badge(text, tone) {
    return '<span class="badge' + (tone ? ' badge-' + tone : '') + '">' + esc(text) + '</span>';
  }

  function progress(value) {
    return '<div class="progress-cell"><div class="mini-track"><i style="width:' + Number(value || 0) + '%"></i></div>' +
      badge(value + '%', value < 75 ? 'orange' : 'green') + '</div>';
  }

  function emptyCard(message) {
    return '<section class="card"><div class="empty-state"><span>✦</span><p>' + esc(message) + '</p></div></section>';
  }

  /* ---------------------------------------------------------------
     Shell
  --------------------------------------------------------------- */
  function sidebar() {
    var me = account();
    var items = (NAV[me.role] || NAV.STUDENT).map(function (item) {
      var active = item[0] === state.page ? ' nav-active' : '';
      return '<button class="nav-item' + active + '" data-nav="' + item[0] + '"><span class="nav-icon">' + item[1] + '</span>' + item[2] +
        (item[0] === 'notices' && state.notices.length ? '<span class="nav-dot"></span>' : '') + '</button>';
    }).join('');

    return '<aside class="sidebar' + (state.menuOpen ? ' sidebar-open' : '') + '">' +
      '<div class="brand"><div class="brand-mark">C<span>.</span></div><div><strong>campus<span>desk</span></strong><small>COLLEGE ERP PORTAL</small></div></div>' +
      '<div class="campus-select"><span class="campus-dot"></span><div><strong>' + esc(collegeName()) + '</strong><small>' +
      (INSTITUTION.academicYear ? 'Academic year ' + esc(INSTITUTION.academicYear) : 'Academic year not set') + '</small></div><span class="chevron">⌄</span></div>' +
      '<div class="menu-caption">WORKSPACE</div>' +
      '<nav>' + items + '</nav>' +
      '<div class="sidebar-bottom">' +
      '<div class="help-card"><span class="help-icon">✳</span><strong>Need a hand?</strong><p>Your class advisor and the college office can help with anything on this portal.</p><button data-action="help">Contact the office <span>→</span></button></div>' +
      '<div class="user-mini"><span class="avatar">' + esc(initialsOf(me.name)) + '</span><div class="user-mini-copy"><strong>' + esc(me.name || 'Account') + '</strong><small>' + esc(me.loginId || '') + '</small></div><button class="logout-button" data-action="logout" aria-label="Sign out" title="Sign out">⏻</button></div>' +
      '</div></aside>' +
      '<button class="mobile-menu" data-action="menu" aria-label="Open menu">☰</button>';
  }

  function topbar() {
    var me = account();
    var today = new Intl.DateTimeFormat('en', { weekday: 'short', day: 'numeric', month: 'short' }).format(new Date());
    var pageName = state.page.charAt(0).toUpperCase() + state.page.slice(1);
    return '<header class="topbar"><div class="breadcrumb"><span>Campus Desk</span><b>/</b><strong>' + esc(pageName) + '</strong></div>' +
      '<div class="topbar-actions"><span class="today-label">' + today + '</span>' +
      '<span class="badge badge-neutral">' + esc(roleLabelOf(me.role)) + '</span>' +
      '<button class="icon-button notification-button" data-nav="notices" aria-label="Notices"><span>✉</span>' +
      (state.notices.length ? '<i></i>' : '') + '</button>' +
      '<span class="topbar-separator"></span>' +
      '<div class="top-user"><span class="avatar avatar-small">' + esc(initialsOf(me.name)) + '</span><span>' + esc(me.name || 'Account') + '</span></div>' +
      '</div></header>';
  }

  function welcome() {
    var me = account();
    var day = new Intl.DateTimeFormat('en', { weekday: 'long' }).format(new Date()).toUpperCase();
    return '<div class="welcome-row"><div><div class="eyebrow"><span class="live-dot"></span> YOUR CAMPUS, IN SYNC</div>' +
      '<h1>' + esc(TITLES[state.page] || TITLES.overview) + '</h1>' +
      '<p class="welcome-sub">Welcome back, ' + esc(String(me.name || '').split(' ')[0] || 'there') + '. Here’s what’s happening today.</p></div>' +
      '<div class="welcome-date"><span>✳</span><div><strong>' + new Intl.DateTimeFormat('en', { month: 'long', day: 'numeric' }).format(new Date()) + '</strong><small>' + day + ' · ' + esc(termLine()) + '</small></div></div></div>';
  }

  function footerBar() {
    return '<footer class="footer"><span>© 2026 Campus Desk</span><span>Built for ' + esc(collegeName()) + ' <b>✳</b></span></footer>';
  }

  /* ---------------------------------------------------------------
     Sign in
  --------------------------------------------------------------- */
  function loginScreen() {
    var hint = PEOPLE.length
      ? ''
      : '<div class="form-error" role="alert">No accounts are configured yet. Open <b>data.js</b>, add a person under <b>people</b>, then refresh this page.</div>';
    return '<div class="login-screen"><div class="login-visual">' +
      '<div class="login-brand"><div class="brand-mark">C<span>.</span></div><strong>campus<span>desk</span></strong></div>' +
      '<div class="login-art"><div class="art-orbit orbit-one"></div><div class="art-orbit orbit-two"></div><div class="art-sun"></div>' +
      '<div class="art-card"><span>✳</span><div><b>A campus that moves together.</b><small>One place for every part of college life.</small></div></div>' +
      '<div class="art-caption"><strong>Make room for what matters.</strong><span>Classes, people, and possibilities.</span></div></div>' +
      '<div class="login-foot"><span>Thoughtfully made for your college.</span><span>✳</span></div></div>' +
      '<div class="login-panel"><div class="login-mobile-brand"><div class="brand-mark">C<span>.</span></div><strong>campus<span>desk</span></strong></div>' +
      '<div class="login-form-wrap"><div class="eyebrow"><span class="live-dot"></span> YOUR CAMPUS, IN SYNC</div>' +
      '<h1>Welcome back.</h1><p class="login-sub">Sign in with the account your college office created for you.</p>' +
      hint + (state.loginError ? '<div class="form-error" role="alert">' + esc(state.loginError) + '</div>' : '') +
      '<form data-form="login"><label for="loginId">USN or employee ID</label>' +
      '<div class="input-wrap"><span>◎</span><input id="loginId" name="loginId" autocomplete="username" placeholder="Your login ID" value="' + esc(state.loginDraft) + '" /></div>' +
      '<label for="password">Password</label>' +
      '<div class="input-wrap"><span>♙</span><input id="password" name="password" type="password" autocomplete="current-password" placeholder="Your password" /></div>' +
      '<button class="button" type="submit">Sign in <span>→</span></button></form>' +
      '<div class="login-demo"><span class="demo-star">✳</span><div><strong>Where do accounts come from?</strong><p>Every login is a person in <b>data.js</b>. The role you set there decides which screens that account can open.</p></div></div>' +
      '<div class="login-legal">By continuing, you agree to your institution’s acceptable use policy.</div></div>' +
      '<div class="login-mobile-foot">Made for a more connected campus <b>✳</b></div></div></div>';
  }

  function signIn(loginId, password) {
    if (!PEOPLE.length) return 'No accounts exist yet. Add one in data.js and refresh.';
    var id = String(loginId || '').trim().toLowerCase();
    if (!id) return 'Enter your login ID.';
    var person = PEOPLE.filter(function (candidate) {
      return String(candidate.loginId || '').trim().toLowerCase() === id;
    })[0];
    if (!person) return 'No account found for that login ID.';
    if (String(person.password || '') !== String(password || '')) return 'That password is not correct.';
    state.session = person;
    state.signedIn = true;
    state.page = 'overview';
    state.locked = false;
    state.loginError = '';
    state.loginDraft = '';
    return '';
  }

  /* ---------------------------------------------------------------
     Overview
  --------------------------------------------------------------- */
  function scheduleCard() {
    var slots = todaySlots();
    if (!slots.length) {
      return '<section class="card schedule-card"><div class="schedule-empty"><div class="empty-illustration">✳</div><div><strong>No classes scheduled today</strong><span>' +
        (TIMETABLE.length ? 'Your next timetabled day will appear here.' : 'Add classes under timetable in data.js.') + '</span></div></div></section>';
    }
    var rows = slots.map(function (slot) {
      return '<div class="schedule-item"><div class="schedule-time"><strong>' + (PERIOD_START[slot.period] || '—') + '</strong><small>PERIOD ' + esc(slot.period) + '</small></div>' +
        '<div class="schedule-line"><i></i></div>' +
        '<div class="schedule-course"><strong>' + esc(slot.name || slot.code) + '</strong><span>' + esc([slot.code, slot.room, slot.staff].filter(Boolean).join(' · ')) + '</span></div></div>';
    }).join('');
    return '<section class="card schedule-card">' + rows + '</section>';
  }

  function noticesCard() {
    if (!state.notices.length) {
      return '<section class="card notices-card">' + sectionTitle('BULLETIN', 'Campus notices', '') +
        '<div class="empty-state"><span>✦</span><p>No notices yet. Add them under notices in data.js.</p></div></section>';
    }
    var items = state.notices.slice(0, 3).map(function (notice) {
      return '<button class="notice-item" data-nav="notices"><span class="notice-mark">✳</span><span class="notice-copy"><strong>' + esc(notice.title) + '</strong><small>' +
        esc([notice.date, notice.author].filter(Boolean).join(' · ')) + '</small></span><span class="notice-arrow">→</span></button>';
    }).join('');
    return '<section class="card notices-card">' + sectionTitle('BULLETIN', 'Campus notices', '<button class="round-action" data-nav="notices" aria-label="All notices">→</button>') +
      items + '<button class="all-notices" data-nav="notices">All notices <span>→</span></button></section>';
  }

  function studentOverview() {
    var me = account();
    var subjects = subjectList(me);
    var average = subjects.length
      ? Math.round(subjects.reduce(function (sum, subject) { return sum + Number(subject.attendance || 0); }, 0) / subjects.length)
      : attendanceRate(me);
    var short = subjects.filter(function (subject) { return Number(subject.attendance || 0) < 75; }).length;
    var fees = feeList(me);

    return '<div class="module-page"><div class="stats-grid">' +
      stat('Attendance average', subjects.length || me.attendance ? average + '%' : '—', '◷', subjects.length ? 'Across ' + subjects.length + ' subjects' : 'Add subjects in data.js') +
      stat('Subjects this semester', subjects.length || '—', '▥', me.semester ? 'Semester ' + me.semester : '') +
      stat('Fees outstanding', fees.length ? money(dueTotal(fees)) : '—', '◇', fees.length ? fees.filter(function (f) { return f.status === 'DUE'; }).length + ' payments due' : 'No fee records') +
      stat('Classes today', todaySlots().length, '▦', todaySlots()[0] ? 'Next: ' + (todaySlots()[0].name || todaySlots()[0].code) : 'Nothing scheduled') +
      '</div><div class="dashboard-grid"><div class="dashboard-main">' +
      sectionTitle('TODAY', 'Your class schedule', '<button class="text-action" data-nav="timetable">Full timetable <span>→</span></button>') + scheduleCard() +
      '<div class="section-block">' + sectionTitle('SUBJECTS', 'This semester', '<button class="text-action" data-nav="attendance">Attendance <span>→</span></button>') +
      (subjects.length
        ? '<section class="card table-card">' + table([
          { label: 'Course', render: function (subject) { return '<strong>' + esc(subject.code || '') + '</strong><span class="cell-sub">' + esc(subject.name || '') + '</span>'; } },
          { label: 'Faculty', render: function (subject) { return esc(subject.faculty || '—'); } },
          { label: 'Credits', render: function (subject) { return esc(subject.credits || 0); } },
          { label: 'Attendance', render: function (subject) { return progress(subject.attendance || 0); } }
        ], subjects) + '</section>'
        : emptyCard('No subjects yet. Add them to this student under subjects in data.js.')) +
      '</div></div>' +
      '<aside class="dashboard-side">' +
      '<section class="card attendance-callout"><div class="callout-top"><span>✳</span>' + badge(short ? short + ' SUBJECT SHORT' : 'ON TRACK', 'cream') + '</div>' +
      '<strong>' + (short ? 'You are below 75% in ' + short + ' subject' + (short > 1 ? 's' : '') + '.' : 'Attendance looks healthy.') + '</strong>' +
      '<p>Keep every subject above the 75% cutoff to stay eligible for the semester examination.</p><div class="callout-line"></div>' +
      '<span class="callout-stat">' + average + '%<small>SEMESTER AVERAGE</small></span></section>' +
      noticesCard() +
      '<section class="card quick-card"><span class="quick-icon">◇</span><div><strong>Fee payment</strong><span>' +
      (fees.length ? money(dueTotal(fees)) + ' due this term' : 'No fee records yet') + '</span></div><button data-nav="fees" aria-label="Open fees">→</button></section>' +
      '</aside></div></div>';
  }

  function staffOverview() {
    var me = account();
    var list = students();
    var pending = list.filter(function (person) { return !hasAllMarks(person); }).length;
    var admin = me.role === 'ADMIN';
    var collected = 0;
    var outstanding = 0;
    list.forEach(function (person) {
      feeList(person).forEach(function (fee) {
        if (fee.status === 'PAID') collected += Number(fee.amount || 0);
        if (fee.status === 'DUE') outstanding += Number(fee.amount || 0);
      });
    });

    return '<div class="module-page"><div class="stats-grid">' +
      stat('Students enrolled', list.length || '—', '☰', list.length ? 'Across your classes' : 'Add students in data.js') +
      stat('Classes today', todaySlots().length, '▦', todaySlots()[0] ? 'Next: ' + (todaySlots()[0].name || todaySlots()[0].code) : 'Nothing scheduled') +
      stat('Marks pending', list.length ? pending + ' students' : '—', '▤', state.locked ? 'Class approved' : 'Draft entry open') +
      (admin
        ? stat('Fees collected', money(collected), '◇', money(outstanding) + ' outstanding')
        : stat('Campus notices', state.notices.length, '✉', state.notices[0] ? 'Latest: ' + state.notices[0].date : 'None yet')) +
      '</div><div class="dashboard-grid"><div class="dashboard-main">' +
      sectionTitle('TODAY', 'Your teaching day', '<button class="text-action" data-nav="timetable">Timetable <span>→</span></button>') + scheduleCard() +
      '<div class="section-block">' + sectionTitle('CLASS ROSTER', 'Students and their progress', '<button class="text-action" data-nav="marks">Open marks <span>→</span></button>') +
      (list.length
        ? '<section class="card table-card">' + table([
          { label: 'Student', render: function (person) { return '<strong>' + esc(person.name) + '</strong><span class="cell-sub">' + esc(person.loginId) + '</span>'; } },
          { label: 'Attendance', render: function (person) { return progress(attendanceRate(person)); } },
          { label: 'Marks', render: function (person) { return hasAllMarks(person) ? badge('COMPLETE', 'green') : badge('PENDING', 'orange'); } }
        ], list) + '</section>'
        : emptyCard('No students yet. Add a person with role STUDENT in data.js.')) +
      '</div></div>' +
      '<aside class="dashboard-side">' + noticesCard() +
      '<section class="card quick-card"><span class="quick-icon">◷</span><div><strong>Mark attendance</strong><span>' + (list.length ? list.length + ' students in class' : 'No students yet') + '</span></div><button data-nav="attendance" aria-label="Mark attendance">→</button></section>' +
      '<section class="card quick-card"><span class="quick-icon">◎</span><div><strong>Review your profile</strong><span>Contact details and department</span></div><button data-nav="profile" aria-label="Profile">→</button></section>' +
      '</aside></div></div>';
  }

  function overviewPage() {
    return account().role === 'STUDENT' ? studentOverview() : staffOverview();
  }

  /* ---------------------------------------------------------------
     Attendance
  --------------------------------------------------------------- */
  function attendancePage() {
    var me = account();

    if (me.role === 'STUDENT') {
      var subjects = subjectList(me);
      var average = subjects.length
        ? Math.round(subjects.reduce(function (sum, subject) { return sum + Number(subject.attendance || 0); }, 0) / subjects.length)
        : attendanceRate(me);
      var attendance = me.attendance || {};
      return '<div class="module-page"><div class="module-stats">' +
        stat('Attendance average', subjects.length || me.attendance ? average + '%' : '—', '◷') +
        stat('Subjects below 75%', subjects.filter(function (subject) { return Number(subject.attendance || 0) < 75; }).length, '◎', subjects.length ? 'Shortage alert' : 'No subjects yet') +
        stat('Classes attended', attendance.total ? (attendance.present || 0) + ' / ' + attendance.total : '—', '▦') + '</div>' +
        sectionTitle('SUBJECT-WISE VIEW', 'Your attendance') +
        (subjects.length
          ? '<section class="card table-card">' + table([
            { label: 'Course', render: function (subject) { return '<strong>' + esc(subject.name || '') + '</strong>'; } },
            { label: 'Code', render: function (subject) { return esc(subject.code || '—'); } },
            { label: 'Faculty', render: function (subject) { return esc(subject.faculty || '—'); } },
            { label: 'Attendance', render: function (subject) { return progress(subject.attendance || 0); } }
          ], subjects) + '</section>'
          : emptyCard('No subjects yet. Add them to this student under subjects in data.js.')) +
        '<section class="card info-panel"><span>✳</span><div><strong>How attendance is calculated.</strong><p>Your percentage comes from the classes your faculty mark each period. A subject below 75% is flagged for a shortage.</p></div></section></div>';
    }

    var list = students();
    var present = list.filter(function (person) { return (state.attendanceDraft[person.loginId] || 'PRESENT') === 'PRESENT'; }).length;
    var absent = list.filter(function (person) { return state.attendanceDraft[person.loginId] === 'ABSENT'; }).length;

    var rows = list.map(function (person, index) {
      var current = state.attendanceDraft[person.loginId] || 'PRESENT';
      var options = [['PRESENT', '✓'], ['ABSENT', '×'], ['LATE', '◷']].map(function (pair) {
        return '<button class="attendance-option ' + (current === pair[0] ? 'option-' + pair[0].toLowerCase() : '') +
          '" data-attendance="' + esc(person.loginId) + '" data-status="' + pair[0] + '" aria-label="' + esc(person.name) + ': ' + pair[0] + '">' + pair[1] + '</button>';
      }).join('');
      return '<div class="roster-row"><span class="roster-number">' + String(index + 1).padStart(2, '0') + '</span><span class="avatar avatar-small">' + esc(String(person.name || '?').charAt(0)) + '</span>' +
        '<div class="roster-name"><strong>' + esc(person.name) + '</strong><small>' + esc(person.loginId) + '</small></div>' +
        '<div class="attendance-options">' + options + '</div></div>';
    }).join('');

    return '<div class="module-page"><div class="module-stats">' +
      stat('Students in class', list.length || '—', '☰') +
      stat('Below 75% attendance', list.filter(function (person) { return attendanceRate(person) < 75; }).length, '◎', 'Shortage list') +
      stat('Today', new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric' }).format(new Date()), '▦') + '</div>' +
      sectionTitle('FACULTY WORKSPACE', 'Mark class attendance') +
      (list.length
        ? '<section class="card attendance-mark-card"><div class="mark-toolbar"><div><strong>Quick mark</strong><span>Select one status per student, then save the entire roster.</span></div>' +
        '<div class="mark-legend">' + badge('PRESENT', 'green') + badge('ABSENT', 'orange') + badge('LATE', 'neutral') + '</div></div>' +
        '<div class="roster">' + rows + '</div>' +
        '<div class="attendance-submit"><span>' + present + ' present · ' + absent + ' absent</span>' +
        '<button class="button" data-action="save-attendance">Save attendance <span>→</span></button></div></section>'
        : emptyCard('No students yet. Add a person with role STUDENT in data.js.')) + '</div>';
  }

  /* ---------------------------------------------------------------
     Marks
  --------------------------------------------------------------- */
  function marksPage() {
    var me = account();

    if (me.role === 'STUDENT') {
      var marks = me.marks || {};
      var components = [
        { component: 'IA1', label: 'Internal assessment 1', max: 25, score: marks.IA1 },
        { component: 'IA2', label: 'Internal assessment 2', max: 25, score: marks.IA2 },
        { component: 'SEE', label: 'Semester end examination', max: 100, score: marks.SEE }
      ];
      var recorded = components.filter(function (row) { return Number(row.score) > 0; }).length;
      var total = components.reduce(function (sum, row) { return sum + Number(row.score || 0); }, 0);
      return '<div class="module-page"><div class="module-stats">' +
        stat('Components published', recorded + ' of 3', '▤') +
        stat('Marks recorded', total || '—', '✦', 'IA1 + IA2 + SEE') +
        stat('Assessment system', 'CIE + SEE', '◇', 'Internal 25 · Semester exam 100') + '</div>' +
        sectionTitle('SEMESTER RESULTS', 'Published marks') +
        '<section class="card table-card">' + table([
          { label: 'Component', render: function (row) { return '<strong>' + esc(row.label) + '</strong><span class="cell-sub">' + esc(row.component) + '</span>'; } },
          { label: 'Score', render: function (row) { return Number(row.score) > 0 ? row.score + ' / ' + row.max : '—'; } },
          { label: 'Status', render: function (row) { return Number(row.score) > 0 ? badge('LOCKED', 'green') : badge('PENDING', 'orange'); } }
        ], components) + '</section>' +
        '<section class="card info-panel"><span>✳</span><div><strong>Results are only published after department approval.</strong><p>Internal marks appear here once your HOD has reviewed and locked the class results.</p></div></section></div>';
    }

    var list = students();
    var hod = me.role === 'HOD';
    var admin = me.role === 'ADMIN';
    var complete = list.filter(hasAllMarks).length;
    var head = '<thead><tr><th scope="col">Student</th><th scope="col">IA1</th><th scope="col">IA2</th><th scope="col">SEE</th><th scope="col">Status</th></tr></thead>';
    var body = list.map(function (person) {
      var cells = [['IA1', 25], ['IA2', 25], ['SEE', 100]].map(function (pair) {
        var component = pair[0];
        var max = pair[1];
        var value = markValue(person, component);
        var disabled = state.locked || (component === 'SEE' && !admin);
        var control = '<input type="number" min="0" max="' + max + '" placeholder="—" aria-label="' + esc(person.loginId) + ' ' + component + '"' +
          (disabled ? ' disabled' : '') + ' value="' + (Number(value) > 0 ? esc(value) : '') + '" data-mark="' + esc(person.loginId) + '" data-component="' + component + '" />';
        if (state.locked) control = '<strong>' + (Number(value) > 0 ? esc(value) : '—') + '</strong>';
        return '<td>' + control + '</td>';
      }).join('');
      return '<tr><td><strong>' + esc(person.name) + '</strong><span class="cell-sub">' + esc(person.loginId) + '</span></td>' + cells +
        '<td>' + (state.locked ? badge('LOCKED', 'green') : badge('DRAFT', 'orange')) + '</td></tr>';
    }).join('');

    return '<div class="module-page"><div class="module-stats">' +
      stat('Students in class', list.length || '—', '▤') +
      stat('Pending approval', list.length ? String(list.length - complete) : '—', '✦', list.length ? complete + ' complete' : 'No students yet') +
      stat('Class status', state.locked ? 'Locked' : 'Draft', '◇', state.locked ? 'Approved by HOD' : 'Editable') + '</div>' +
      sectionTitle(hod ? 'DEPARTMENT REVIEW' : admin ? 'ADMINISTRATOR MARKS' : 'FACULTY WORKSPACE',
        hod ? 'Approve and lock marks' : 'Enter internal marks') +
      (list.length
        ? '<section class="card marks-card"><div class="mark-toolbar"><div><strong>Class marks</strong>' +
        '<span>' + (hod ? 'Review every student, then approve to publish.' : admin ? 'Enter CIE and semester exam marks out of 100.' : 'Internal assessment is recorded out of 25 marks. SEE is entered by administrators.') + '</span></div>' +
        '<div class="mark-legend">' + badge('IA1 / 25', 'neutral') + badge('IA2 / 25', 'neutral') + badge('SEE / 100', 'neutral') + '</div></div>' +
        '<div class="table-wrap"><table>' + head + '<tbody>' + body + '</tbody></table></div>' +
        '<div class="attendance-submit"><span>' + complete + ' of ' + list.length + ' students have all three components recorded.</span>' +
        (hod
          ? '<button class="button" data-action="approve"' + (state.locked ? ' disabled' : '') + '>' +
          (state.locked ? 'Marks approved & locked' : complete === list.length ? 'Approve & lock marks' : 'Complete all marks (' + complete + '/' + list.length + ')') + ' <span>→</span></button>'
          : '<span class="badge badge-neutral">Saves on change</span>') +
        '</div></section>'
        : emptyCard('No students yet. Add a person with role STUDENT in data.js.')) + '</div>';
  }

  /* ---------------------------------------------------------------
     Timetable
  --------------------------------------------------------------- */
  function timetablePage() {
    if (!TIMETABLE.length) {
      return '<div class="module-page">' + sectionTitle('SEMESTER TIMETABLE', 'Your weekly rhythm') +
        emptyCard('No timetable yet. Add periods under timetable in data.js — one line per class.') +
        calendarCard() + '</div>';
    }

    var days = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
    var head = '<div class="timetable-header time-header">PERIOD</div>' + days.map(function (day) {
      return '<div class="timetable-header">' + day + '</div>';
    }).join('');
    var cells = '';
    for (var period = 1; period <= PERIOD_COUNT; period += 1) {
      cells += '<div class="period-label"><strong>' + (PERIOD_START[period] || '—') + '</strong><small>PERIOD ' + period + '</small></div>';
      for (var day = 1; day <= 6; day += 1) {
        var slot = TIMETABLE.filter(function (item) {
          return Number(item.day) === day && Number(item.period) === period;
        })[0];
        if (slot && slot.code) {
          cells += '<div class="timetable-cell has-class"><div class="class-block"><strong>' + esc(slot.code || '') + '</strong><span>' + esc(slot.name || '') + '</span><small>' +
            esc([slot.room, slot.staff].filter(Boolean).join(' · ')) + '</small></div></div>';
        } else {
          cells += '<div class="timetable-cell"><span class="free-dash">—</span></div>';
        }
      }
    }

    return '<div class="module-page">' + sectionTitle('SEMESTER TIMETABLE', 'Your weekly rhythm') +
      '<div class="timetable-meta"><span><i class="legend-mark"></i> Scheduled class</span><span>Monday – Saturday · Periods 1–7</span></div>' +
      '<section class="card timetable-card"><div class="timetable-scroll"><div class="timetable-grid">' + head + cells + '</div></div></section>' +
      calendarCard() + '</div>';
  }

  function calendarCard() {
    if (!CALENDAR.length) {
      return '<section class="card calendar-note"><span class="calendar-icon">✧</span><div><strong>Academic calendar</strong><p>No events yet. Add exam dates and holidays under calendar in data.js.</p></div></section>';
    }
    var events = CALENDAR.map(function (event) {
      return '<div><span class="event-date">' + new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric' }).format(new Date(event.date)) + '</span>' +
        '<span><b>' + esc(event.title) + '</b><small>' + esc(event.kind || '') + '</small></span></div>';
    }).join('');
    return '<section class="card calendar-note"><span class="calendar-icon">✧</span><div><strong>Academic calendar</strong><div class="event-list">' + events + '</div></div></section>';
  }

  /* ---------------------------------------------------------------
     Notices
  --------------------------------------------------------------- */
  function noticesPage() {
    var canPost = account().role !== 'STUDENT';
    var feed = state.notices.map(function (notice, index) {
      return '<section class="card notice-feed-item"><div class="feed-mark mark-' + (index % 3) + '">' + ['✳', '◉', '↗'][index % 3] + '</div>' +
        '<div class="feed-content"><div class="feed-meta"><span>' + esc(notice.audience || 'CAMPUS-WIDE') + '</span><time>' + esc(notice.date || '') + '</time></div>' +
        '<h3>' + esc(notice.title) + '</h3><p>' + esc(notice.body) + '</p><small>Posted by ' + esc(notice.author || 'Campus office') + '</small></div></section>';
    }).join('');

    var compose = canPost
      ? '<section class="card notice-compose"><div class="compose-heading"><span class="compose-icon">✳</span><div><strong>Share an update</strong><span>Post to your class, department, or the whole college.</span></div></div>' +
      '<form data-form="notice"><label for="noticeTitle">Title</label><input id="noticeTitle" placeholder="Give your notice a clear title" />' +
      '<label for="noticeBody">Message</label><textarea id="noticeBody" rows="4" placeholder="What should everyone know?"></textarea>' +
      '<div class="compose-actions"><select id="noticeAudience" aria-label="Audience">' +
      [['CAMPUS-WIDE', 'Everyone · college-wide'], ['DEPARTMENT', 'My department'], ['CLASS', 'My class']].map(function (pair) {
        return '<option value="' + pair[0] + '">' + pair[1] + '</option>';
      }).join('') + '</select><button class="button" type="submit">Publish notice <span>→</span></button></div></form></section>'
      : '';

    return '<div class="module-page">' +
      sectionTitle('CAMPUS BULLETIN', 'Notices & circulars', '<span class="notice-count">' + state.notices.length + ' recent notices</span>') +
      compose +
      (state.notices.length ? '<div class="notice-feed">' + feed + '</div>' : emptyCard('No notices yet. Publish one above, or add them under notices in data.js.')) +
      '</div>';
  }

  /* ---------------------------------------------------------------
     Fees
  --------------------------------------------------------------- */
  function feesPage() {
    var me = account();

    if (me.role === 'ADMIN') {
      var rows = [];
      var collected = 0;
      var outstanding = 0;
      students().forEach(function (person) {
        feeList(person).forEach(function (fee) {
          if (fee.status === 'PAID') collected += Number(fee.amount || 0);
          if (fee.status === 'DUE') outstanding += Number(fee.amount || 0);
          rows.push({ student: person, fee: fee });
        });
      });
      return '<div class="module-page"><div class="module-stats">' +
        stat('Collected', money(collected), '◇') +
        stat('Outstanding', money(outstanding), '◎') +
        stat('Fee records', rows.length || '—', '▤') + '</div>' +
        sectionTitle('FINANCE', 'Fee ledger across the college') +
        (rows.length
          ? '<section class="card table-card">' + table([
            { label: 'Student', render: function (row) { return '<strong>' + esc(row.student.name) + '</strong><span class="cell-sub">' + esc(row.student.loginId) + '</span>'; } },
            { label: 'Particulars', render: function (row) { return esc(row.fee.particulars || row.fee.term || '—'); } },
            { label: 'Amount', render: function (row) { return money(row.fee.amount); } },
            { label: 'Due date', render: function (row) { return esc(row.fee.due || '—'); } },
            { label: 'Status', render: function (row) { return badge(row.fee.status || 'DUE', row.fee.status === 'PAID' ? 'green' : row.fee.status === 'UPCOMING' ? 'neutral' : 'orange'); } }
          ], rows) + '</section>'
          : emptyCard('No fee records yet. Add fees inside a student account in data.js.')) + '</div>';
    }

    var fees = feeList(me);
    var due = dueTotal(fees);
    return '<div class="module-page"><div class="module-stats">' +
      stat('Outstanding', fees.length ? money(due) : '—', '◇', fees.filter(function (fee) { return fee.status === 'DUE'; }).length + ' payments due') +
      stat('Paid', money(fees.filter(function (fee) { return fee.status === 'PAID'; }).reduce(function (sum, fee) { return sum + Number(fee.amount || 0); }, 0)), '✓') +
      stat('Fee records', fees.length || '—', '▤') + '</div>' +
      sectionTitle('FEE LEDGER', 'Your payments') +
      (fees.length
        ? '<section class="card table-card">' + table([
          { label: 'Particulars', render: function (fee) { return '<strong>' + esc(fee.particulars || fee.term || '—') + '</strong>'; } },
          { label: 'Amount', render: function (fee) { return money(fee.amount); } },
          { label: 'Due date', render: function (fee) { return esc(fee.due || '—'); } },
          { label: 'Status', render: function (fee) { return badge(fee.status || 'DUE', fee.status === 'PAID' ? 'green' : fee.status === 'UPCOMING' ? 'neutral' : 'orange'); } },
          { label: '', render: function (fee) { return fee.status === 'PAID' ? '<span class="cell-sub">Receipt available</span>' : '<button class="text-action" data-pay="' + esc(fee.id) + '">Pay now <span>→</span></button>'; } }
        ], fees) + '</section>'
        : emptyCard('No fee records yet. Add them to this student under fees in data.js.')) +
      '<section class="card info-panel"><span>✳</span><div><strong>Payments are reconciled within 24 hours.</strong><p>Keep the transaction reference until the receipt appears in your ledger. Contact the accounts office for any mismatch.</p></div></section></div>';
  }

  /* ---------------------------------------------------------------
     Courses
  --------------------------------------------------------------- */
  function coursesPage() {
    var me = account();
    var cards = COURSES.map(function (course, index) {
      return '<section class="card course-card"><div class="course-card-top"><span class="course-symbol symbol-' + (index % 4) + '">▥</span><span class="course-credit">' + esc(course.credits || 0) + ' CREDITS</span></div>' +
        '<h3>' + esc(course.name || '') + '</h3><span class="course-code">' + esc([course.code, course.faculty].filter(Boolean).join(' · ')) + '</span>' +
        '<div class="course-footer"><span>' + esc([course.semester ? 'Semester ' + course.semester : '', course.section ? 'Section ' + course.section : ''].filter(Boolean).join(' · ') || 'Not assigned') + '</span><strong>' +
        progress(course.attendance || 0) + '</strong></div></section>';
    }).join('');

    var create = me.role === 'ADMIN'
      ? '<section class="card form-card"><div class="section-title"><div><div class="eyebrow">CATALOGUE</div><h2>Add a course</h2></div></div>' +
      '<form class="course-create-form" data-form="course"><label>Course code<input id="courseCode" placeholder="CS406" /></label>' +
      '<label>Course title<input id="courseName" placeholder="Distributed Systems" /></label>' +
      '<label>Credits<select id="courseCredits"><option>3</option><option>4</option></select></label>' +
      '<div class="form-action-row"><span>Saved for this session only.</span><button class="button" type="submit">Add course <span>→</span></button></div></form></section>'
      : '';

    return '<div class="module-page">' +
      sectionTitle('ACADEMIC CATALOGUE', 'Courses this semester', '<span class="notice-count">' + COURSES.length + ' courses</span>') +
      create +
      (COURSES.length ? '<div class="course-grid">' + cards + '</div>' : emptyCard('No courses yet. Add them under courses in data.js.')) +
      '</div>';
  }

  /* ---------------------------------------------------------------
     Reports
  --------------------------------------------------------------- */
  function reportsPage() {
    var list = students();
    var average = list.length
      ? Math.round(list.reduce(function (sum, person) { return sum + attendanceRate(person); }, 0) / list.length)
      : 0;
    var risk = list.filter(function (person) { return attendanceRate(person) < 75; }).length;
    var complete = list.filter(hasAllMarks).length;

    return '<div class="module-page"><div class="module-stats">' +
      stat('Students tracked', list.length || '—', '☰') +
      stat('Average attendance', list.length ? average + '%' : '—', '◷', list.length ? 'Across the department' : 'No students yet') +
      stat('Students at risk', list.length ? risk : '—', '◎', list.length ? 'Below 75% attendance' : '') + '</div>' +
      '<section class="card analytics-card"><div class="analytics-lead"><span>✳</span><div><strong>' + esc(INSTITUTION.semester ? 'Semester ' + INSTITUTION.semester + ' · ' + (INSTITUTION.section ? 'Section ' + INSTITUTION.section : '') : 'Department overview') + '</strong>' +
      '<p>Snapshot generated from the attendance and marks recorded on this portal.</p></div></div>' +
      '<div class="analytics-grid"><div><span>Average attendance</span><strong>' + (list.length ? average + '%' : '—') + '</strong></div>' +
      '<div><span>Marks complete</span><strong>' + (list.length ? complete + '/' + list.length : '—') + '</strong></div>' +
      '<div><span>Students at risk</span><strong>' + (list.length ? risk : '—') + '</strong></div></div></section>' +
      sectionTitle('DEPARTMENT VIEW', 'Student performance') +
      (list.length
        ? '<section class="card table-card">' + table([
          { label: 'Student', render: function (person) { return '<strong>' + esc(person.name) + '</strong><span class="cell-sub">' + esc(person.loginId) + '</span>'; } },
          { label: 'Section', render: function (person) { return esc(person.section || '—'); } },
          { label: 'Attendance', render: function (person) { return progress(attendanceRate(person)); } },
          { label: 'IA1', render: function (person) { return Number((person.marks || {}).IA1) || '—'; } },
          { label: 'IA2', render: function (person) { return Number((person.marks || {}).IA2) || '—'; } },
          { label: 'SEE', render: function (person) { return Number((person.marks || {}).SEE) || '—'; } },
          { label: 'Risk', render: function (person) { return attendanceRate(person) < 75 ? badge('SHORTAGE', 'orange') : badge('OK', 'green'); } }
        ], list) + '</section>'
        : emptyCard('No students yet. Add them under people in data.js.')) + '</div>';
  }

  /* ---------------------------------------------------------------
     Users (administrator)
  --------------------------------------------------------------- */
  function usersPage() {
    var rows = PEOPLE.map(function (person) {
      return '<tr><td><strong>' + esc(person.name) + '</strong><span class="cell-sub">' + esc(person.loginId) + '</span></td>' +
        '<td>' + esc(roleLabelOf(person.role)) + '</td>' +
        '<td>' + esc(person.department || '—') + '</td>' +
        '<td>' + badge('ACTIVE', 'green') + '</td></tr>';
    }).join('');

    return '<div class="module-page"><div class="module-stats">' +
      stat('Accounts', PEOPLE.length || '—', '☰') +
      stat('Students', students().length, '◎') +
      stat('Faculty & staff', PEOPLE.filter(function (person) { return person.role !== 'STUDENT'; }).length, '✦') + '</div>' +
      sectionTitle('ACCESS CONTROL', 'Campus users') +
      '<section class="card form-card"><div class="section-title"><div><div class="eyebrow">NEW ACCOUNT</div><h2>Add a person</h2></div></div>' +
      '<form class="user-form" data-form="user"><label>Full name<input id="userName" placeholder="Riya Kulkarni" /></label>' +
      '<label>Login ID<input id="userLogin" placeholder="1MJ24CS213" /></label>' +
      '<label>Password<input id="userPassword" type="text" placeholder="Temporary password" /></label>' +
      '<label>Role<select id="userRole"><option value="STUDENT">Student</option><option value="TEACHER">Faculty</option><option value="HOD">HOD</option><option value="ADMIN">Administrator</option></select></label>' +
      '<label>Department<input id="userDept" placeholder="Computer Science" /></label>' +
      '<div class="form-action-row"><span>Added for this session only — make it permanent in data.js.</span><button class="button" type="submit">Create account <span>→</span></button></div></form></section>' +
      (PEOPLE.length
        ? '<section class="card table-card"><div class="table-wrap"><table><thead><tr><th scope="col">Person</th><th scope="col">Role</th><th scope="col">Department</th><th scope="col">Status</th></tr></thead><tbody>' + rows + '</tbody></table></div></section>'
        : emptyCard('No accounts yet. Add your first person under people in data.js.')) +
      '</div>';
  }

  /* ---------------------------------------------------------------
     Profile
  --------------------------------------------------------------- */
  function profilePage() {
    var me = account();
    return '<div class="module-page"><div class="profile-grid">' +
      '<section class="card profile-identity"><div class="profile-avatar">' + esc(initialsOf(me.name)) + '</div><h2>' + esc(me.name || 'Account') + '</h2>' +
      '<span class="profile-role">' + esc(subtitleOf(me) || roleLabelOf(me.role)) + '</span>' +
      '<div class="identity-line"><span>Login ID</span><strong>' + esc(me.loginId || '—') + '</strong></div>' +
      '<div class="identity-line"><span>Role</span><strong>' + esc(roleLabelOf(me.role)) + '</strong></div>' +
      '<div class="identity-line"><span>Department</span><strong>' + esc(me.department || '—') + '</strong></div>' +
      '<div class="identity-line"><span>Email</span><strong>' + esc(me.email || '—') + '</strong></div>' +
      (me.mentor ? '<div class="identity-line"><span>Mentor</span><strong>' + esc(me.mentor) + '</strong></div>' : '') +
      '</section>' +
      '<div class="profile-forms"><section class="card form-card"><div class="section-title"><div><div class="eyebrow">ACCOUNT</div><h2>Contact details</h2></div></div>' +
      '<form class="user-form" data-form="profile"><label>Email<input id="profileEmail" value="' + esc(me.email || '') + '" /></label>' +
      '<label>Phone<input id="profilePhone" value="' + esc(me.phone || '') + '" /></label>' +
      '<div class="form-action-row"><span>Saved for this session — make it permanent in data.js.</span><button class="button" type="submit">Save changes <span>→</span></button></div></form></section>' +
      '<section class="card form-card"><div class="section-title"><div><div class="eyebrow">SECURITY</div><h2>Password</h2></div></div>' +
      '<form class="user-form" data-form="password"><label>Current password<input type="password" placeholder="Current password" /></label>' +
      '<label>New password<input type="password" placeholder="At least 12 characters" /></label>' +
      '<div class="form-action-row"><span>Demo only — real password changes run on the server.</span><button class="button button-secondary" type="submit">Update password <span>→</span></button></div></form></section>' +
      '</div></div></div>';
  }

  /* ---------------------------------------------------------------
     Router
  --------------------------------------------------------------- */
  function pageContent() {
    switch (state.page) {
      case 'attendance': return attendancePage();
      case 'marks': return marksPage();
      case 'timetable': return timetablePage();
      case 'notices': return noticesPage();
      case 'fees': return feesPage();
      case 'courses': return coursesPage();
      case 'reports': return reportsPage();
      case 'users': return usersPage();
      case 'profile': return profilePage();
      default: return overviewPage();
    }
  }

  function render() {
    var root = document.getElementById('app');
    if (!root) return;
    if (!state.signedIn || !state.session) {
      root.innerHTML = loginScreen();
      return;
    }
    root.innerHTML = '<div class="app-shell">' + sidebar() + '<main class="main-shell">' + topbar() +
      '<div class="page-content">' + welcome() + pageContent() + '</div>' + footerBar() + '</main></div>' +
      (state.menuOpen ? '<button class="mobile-scrim" data-action="menu" aria-label="Close menu"></button>' : '') +
      (state.toast ? '<div class="toast" role="status">' + esc(state.toast) + '</div>' : '');
  }

  function go(page) {
    var allowed = (NAV[account().role] || NAV.STUDENT).map(function (item) { return item[0]; });
    state.page = allowed.indexOf(page) === -1 ? 'overview' : page;
    state.menuOpen = false;
    render();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  /* ---------------------------------------------------------------
     Events
  --------------------------------------------------------------- */
  document.addEventListener('click', function (event) {
    if (!event.target || !event.target.closest) return;

    var nav = event.target.closest('[data-nav]');
    if (nav) {
      go(nav.getAttribute('data-nav'));
      return;
    }

    var attendanceButton = event.target.closest('button[data-attendance]');
    if (attendanceButton) {
      state.attendanceDraft[attendanceButton.getAttribute('data-attendance')] = attendanceButton.getAttribute('data-status');
      render();
      return;
    }

    var payButton = event.target.closest('[data-pay]');
    if (payButton && account().role === 'STUDENT') {
      var feeId = payButton.getAttribute('data-pay');
      account().fees = feeList(account()).map(function (fee) {
        return fee.id === feeId ? { id: fee.id, particulars: fee.particulars, amount: fee.amount, due: fee.due, status: 'PAID' } : fee;
      });
      toast('Payment recorded. A receipt will appear in your ledger.');
      return;
    }

    var action = event.target.closest('[data-action]');
    if (!action) return;
    var name = action.getAttribute('data-action');

    if (name === 'menu') {
      state.menuOpen = !state.menuOpen;
      render();
    } else if (name === 'logout') {
      state.signedIn = false;
      state.session = null;
      state.page = 'overview';
      state.menuOpen = false;
      state.loginError = '';
      state.loginDraft = '';
      render();
    } else if (name === 'help') {
      toast('Contact your college office for help with accounts, fees or results.');
    } else if (name === 'save-attendance') {
      students().forEach(function (person) {
        var status = state.attendanceDraft[person.loginId] || 'PRESENT';
        var attendance = person.attendance || { present: 0, total: 0 };
        attendance.total = Number(attendance.total || 0) + 1;
        if (status !== 'ABSENT') attendance.present = Number(attendance.present || 0) + 1;
        person.attendance = attendance;
        state.attendanceDraft[person.loginId] = 'PRESENT';
      });
      toast('Attendance saved for the whole class.');
    } else if (name === 'approve') {
      var list = students();
      if (!list.length || !list.every(hasAllMarks)) {
        toast('Enter all IA1, IA2 and SEE marks before approval.');
        return;
      }
      state.locked = true;
      toast('Marks approved and locked for the class.');
    }
  });

  document.addEventListener('change', function (event) {
    if (!event.target || !event.target.closest) return;
    var field = event.target.closest('input[data-mark]');
    if (!field) return;
    state.marksDraft[field.getAttribute('data-mark') + ':' + field.getAttribute('data-component')] = field.value;
    render();
  });

  document.addEventListener('submit', function (event) {
    var form = event.target && event.target.closest ? event.target.closest('form[data-form]') : null;
    if (!form) return;
    event.preventDefault();
    var kind = form.getAttribute('data-form');
    var value = function (id) {
      var element = document.getElementById(id);
      return element ? String(element.value || '').trim() : '';
    };

    if (kind === 'login') {
      var error = signIn(value('loginId'), String((document.getElementById('password') || {}).value || ''));
      if (error) {
        state.loginError = error;
        state.loginDraft = value('loginId');
        render();
        return;
      }
      toast('Welcome back, ' + String(account().name || '').split(' ')[0] + '.');
    } else if (kind === 'notice') {
      var title = value('noticeTitle');
      var body = value('noticeBody');
      if (!title || !body) {
        toast('Add a title and a message before publishing.');
        return;
      }
      state.notices = [{
        id: 'n' + Date.now(),
        title: title,
        body: body,
        audience: value('noticeAudience') || 'CAMPUS-WIDE',
        author: account().name,
        date: new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric', year: 'numeric' }).format(new Date())
      }].concat(state.notices);
      toast('Your notice has been published.');
    } else if (kind === 'user') {
      var personName = value('userName');
      var personLogin = value('userLogin');
      if (!personName || !personLogin) {
        toast('A name and login ID are required.');
        return;
      }
      PEOPLE.push({
        name: personName,
        loginId: personLogin,
        password: value('userPassword') || 'ChangeMe@2026',
        role: value('userRole') || 'STUDENT',
        department: value('userDept') || '',
        email: '',
        phone: ''
      });
      toast('Account created for ' + personName + '.');
    } else if (kind === 'course') {
      var code = value('courseCode');
      var courseName = value('courseName');
      if (!code || !courseName) {
        toast('A course code and title are required.');
        return;
      }
      COURSES.push({ code: code, name: courseName, credits: Number(value('courseCredits')) || 3, faculty: '', semester: INSTITUTION.semester, section: INSTITUTION.section, attendance: 0 });
      toast(courseName + ' added to the catalogue.');
    } else if (kind === 'profile') {
      account().email = value('profileEmail');
      account().phone = value('profilePhone');
      toast('Contact details saved.');
    } else if (kind === 'password') {
      toast('Password changes are handled by the server in the full stack.');
    }
  });

  render();
})();
