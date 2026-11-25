import React from 'react';

export function Button({children,variant='primary',...props}){return <button className={`button button-${variant}`} {...props}>{children}</button>;}
export function Card({children,className=''}){return <section className={`card ${className}`}>{children}</section>;}
export function Stat({label,value,delta,icon='◈'}){return <Card className="stat-card"><span className="stat-icon">{icon}</span><div><span className="stat-label">{label}</span><strong className="stat-value">{value}</strong>{delta&&<span className="stat-delta">{delta}</span>}</div></Card>;}
export function SectionTitle({eyebrow,title,action}){return <div className="section-title"><div>{eyebrow&&<div className="eyebrow">{eyebrow}</div>}<h2>{title}</h2></div>{action}</div>;}
export function Empty({children='Nothing here yet.'}){return <div className="empty-state"><span>✦</span><p>{children}</p></div>;}
export function Table({columns,rows,onRow}){if(!rows?.length)return <Empty>No records to display.</Empty>;return <div className="table-wrap"><table><thead><tr>{columns.map((c,i)=><th key={`${c.key}-${i}`} scope="col">{c.label}</th>)}</tr></thead><tbody>{rows.map((row,i)=><tr key={row.id||row.usn||row.code||i} onClick={()=>onRow?.(row)}>{columns.map((c,i)=><td key={`${c.key}-${i}`}>{c.render?c.render(row[c.key],row):String(row[c.key]??'—')}</td>)}</tr>)}</tbody></table></div>;}
export function Badge({children,tone='green'}){return <span className={`badge badge-${tone}`}>{children}</span>;}
export function Loading(){return <div className="loading"><span className="spinner"/>Loading your campus…</div>;}
