import React, { useCallback, useEffect, useState } from 'react';
import { api } from '../lib/api.js';
import { Badge, Button, Card, Empty, SectionTitle, Stat, Table } from '../components/Primitives.jsx';

const COMPONENTS = ['IA1', 'IA2', 'SEE'];
const SEP = ':';
const cellKey = (studentId, component) => studentId + SEP + component;

const studentColumns = [
  { key: 'offering', label: 'Course', render: (value) => value.course.code + ' · ' + value.course.name },
  { key: 'component', label: 'Component' },
  { key: 'score', label: 'Score', render: (value, row) => value + ' / ' + row.maxScore },
  {
    key: 'updatedAt',
    label: 'Published',
    render: (value) => new Date(value).toLocaleDateString('en', { month: 'short', day: 'numeric', year: 'numeric' }),
  },
  { key: 'isLocked', label: 'Status', render: () => 'APPROVED' },
];

export default function Marks({ user, onToast }) {
  const isStudent = user.role === 'STUDENT';
  const isHod = user.role === 'HOD';
  const isAdmin = user.role === 'ADMIN';

  const [items, setItems] = useState([]);
  const [classes, setClasses] = useState([]);
  const [selected, setSelected] = useState('');
  const [students, setStudents] = useState([]);
  const [marks, setMarks] = useState({});
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const loadGrid = useCallback(async (offeringId) => {
    const result = await api.get('/marks/class/' + offeringId);
    setStudents(result.items);
    const next = {};
    result.items.forEach((row) => {
      row.marks.forEach((mark) => {
        next[cellKey(row.student.id, mark.component)] = mark.score;
      });
    });
    setMarks(next);
  }, []);

  const load = useCallback(async () => {
    try {
      if (isStudent) {
        const result = await api.get('/marks/me');
        setItems(result.items);
        return;
      }
      const result = await api.get('/attendance/classes');
      setClasses(result.items);
      setSelected((current) => {
        if (!result.items.length) return '';
        return result.items.some((item) => item.id === current) ? current : result.items[0].id;
      });
    } catch (e) {
      setError(e.message);
    }
  }, [isStudent]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (isStudent || !selected) return undefined;
    let active = true;
    loadGrid(selected).catch((e) => {
      if (active) setError(e.message);
    });
    return () => {
      active = false;
    };
  }, [selected, isStudent, loadGrid]);

  const activeClass = classes.find((item) => item.id === selected);
  const canEdit = !isHod || isAdmin || Boolean(activeClass && user.staff && activeClass.staffId === user.staff.id);

  const recorded = (row, component) => row.marks.find((mark) => mark.component === component);
  const isLocked = (row, component) => {
    const mark = recorded(row, component);
    return Boolean(mark && mark.isLocked);
  };
  const complete = students.filter((row) => COMPONENTS.every((component) => recorded(row, component))).length;
  const average = items.length
    ? Math.round(items.reduce((sum, mark) => sum + (mark.score / mark.maxScore) * 100, 0) / items.length)
    : 0;

  async function saveCell(studentId, component, value) {
    const score = Number(value);
    if (value === '' || !Number.isFinite(score)) return;
    const row = students.find((item) => item.student.id === studentId);
    const existing = row ? recorded(row, component) : undefined;
    let overrideReason;
    if (existing && existing.isLocked) {
      if (!isAdmin) return;
      const reason = window.prompt('This mark is locked. Enter the reason for the administrator override:');
      if (!reason || reason.trim().length < 8) return;
      overrideReason = reason.trim();
    }
    setBusy(true);
    setError('');
    try {
      const payload = {
        offeringId: selected,
        studentId,
        component,
        score,
        maxScore: component === 'SEE' ? 100 : 25,
      };
      if (overrideReason) payload.overrideReason = overrideReason;
      await api.put('/marks', payload);
      onToast?.('Mark saved securely.');
      await loadGrid(selected);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  async function approve() {
    setBusy(true);
    setError('');
    try {
      const result = await api.post('/marks/approve/' + selected, {});
      onToast?.(result.count + ' marks approved and locked.');
      await loadGrid(selected);
      await load();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  const heading = isHod ? 'DEPARTMENT REVIEW' : isAdmin ? 'ADMINISTRATOR MARKS' : 'FACULTY WORKSPACE';

  return (
    <div className="module-page">
      <div className="module-stats">
        <Stat
          label={isStudent ? 'Published components' : 'Classes with marks'}
          value={isStudent ? items.length : classes.length}
          icon="▤"
        />
        <Stat
          label={isStudent ? 'Current marks average' : 'Students pending approval'}
          value={isStudent ? average + '%' : students.filter((row) => !row.isLocked).length}
          icon="✦"
        />
        <Stat label="Assessment system" value="CIE + SEE" delta="Internal 25 · Semester exam 100" icon="◇" />
      </div>

      {error && <div className="form-error">{error}</div>}

      {isStudent ? (
        <>
          <SectionTitle eyebrow="SEMESTER RESULTS" title="Published marks" />
          <Card className="table-card">
            <Table columns={studentColumns} rows={items} />
          </Card>
          <Card className="info-panel">
            <span>✳</span>
            <div>
              <strong>Results are only published after department approval.</strong>
              <p>Internal marks appear here once your HOD has reviewed and locked the class results.</p>
            </div>
          </Card>
        </>
      ) : (
        <>
          <SectionTitle
            eyebrow={heading}
            title={isHod ? 'Approve and lock marks' : 'Enter internal marks'}
            action={
              <div className="class-select">
                <label htmlFor="marks-class">CLASS</label>
                <select id="marks-class" value={selected} onChange={(event) => setSelected(event.target.value)}>
                  {classes.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.course.code} · Sem {item.section.semester} {item.section.name}
                    </option>
                  ))}
                </select>
              </div>
            }
          />

          {!classes.length ? (
            <Card>
              <Empty>No classes are assigned to you yet. Ask the college office to allocate your classes.</Empty>
            </Card>
          ) : (
            <Card className="marks-card">
              {!students.length ? (
                <Empty>Select a class to record marks.</Empty>
              ) : (
                <>
                  <div className="mark-toolbar">
                    <div>
                      <strong>{activeClass ? activeClass.course.name : 'Class roster'}</strong>
                      <span>
                        {isHod
                          ? 'Review every student, then approve to publish.'
                          : isAdmin
                            ? 'Enter CIE and semester exam marks out of 100.'
                            : 'Internal assessment is recorded out of 25 marks.'}
                      </span>
                    </div>
                    <div className="mark-legend">
                      <Badge tone="neutral">IA1 / 25</Badge>
                      <Badge tone="neutral">IA2 / 25</Badge>
                      <Badge tone="neutral">SEE / 100</Badge>
                    </div>
                  </div>

                  <div className="table-wrap">
                    <table>
                      <thead>
                        <tr>
                          <th scope="col">Student</th>
                          {COMPONENTS.map((component) => (
                            <th key={component} scope="col">
                              {component}
                            </th>
                          ))}
                          <th scope="col">Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {students.map((row) => (
                          <tr key={row.student.id}>
                            <td>
                              <strong>{row.student.name}</strong>
                              <span className="cell-sub">{row.student.usn}</span>
                            </td>
                            {COMPONENTS.map((component) => (
                              <td key={component}>
                                {canEdit ? (
                                  <input
                                    type="number"
                                    min="0"
                                    max={component === 'SEE' ? 100 : 25}
                                    placeholder="—"
                                    aria-label={row.student.usn + ' ' + component}
                                    disabled={busy || (component === 'SEE' && !isAdmin) || (isLocked(row, component) && !isAdmin)}
                                    value={
                                      marks[cellKey(row.student.id, component)] === undefined
                                        ? ''
                                        : marks[cellKey(row.student.id, component)]
                                    }
                                    onChange={(event) =>
                                      setMarks({ ...marks, [cellKey(row.student.id, component)]: event.target.value })
                                    }
                                    onBlur={(event) => {
                                      if (event.target.value !== '') {
                                        saveCell(row.student.id, component, event.target.value);
                                      }
                                    }}
                                  />
                                ) : (
                                  <strong>
                                    {recorded(row, component) ? recorded(row, component).score : '—'}
                                  </strong>
                                )}
                              </td>
                            ))}
                            <td>
                              <Badge tone={row.isLocked ? 'green' : 'orange'}>
                                {row.isLocked ? 'LOCKED' : 'DRAFT'}
                              </Badge>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {isHod && (
                    <div className="attendance-submit">
                      <span>
                        {complete} of {students.length} students have all three components recorded.
                      </span>
                      <Button disabled={busy || complete !== students.length} onClick={approve}>
                        {busy
                          ? 'Approving…'
                          : complete === students.length
                            ? 'Approve & lock marks'
                            : 'Complete all marks (' + complete + '/' + students.length + ')'}
                        <span>→</span>
                      </Button>
                    </div>
                  )}

                  {isAdmin && (
                    <div className="attendance-submit">
                      <span>
                        SEE marks are entered by administrators. Editing a locked mark asks for an override reason.
                      </span>
                    </div>
                  )}
                </>
              )}
            </Card>
          )}
        </>
      )}
    </div>
  );
}
