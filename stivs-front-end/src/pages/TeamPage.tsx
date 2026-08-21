import React from 'react';
import { useTranslation } from 'react-i18next';
import { Layers, ShieldCheck, Sparkles, Mail } from 'lucide-react';
import './TeamPage.css';

type TeamMember = {
  name: string;
  roleKey: string;
  focusKey: string;
  stack: string[];
};

const developerTeam: TeamMember[] = [
  {
    name: 'Алия Ержанова',
    roleKey: 'team_role_frontend_lead',
    focusKey: 'team_focus_frontend_lead',
    stack: ['React', 'TypeScript', 'Vite'],
  },
  {
    name: 'Марат Садыков',
    roleKey: 'team_role_data_viz',
    focusKey: 'team_focus_data_viz',
    stack: ['D3.js', 'Mapbox', 'Chart.js'],
  },
  {
    name: 'Ольга Полякова',
    roleKey: 'team_role_fullstack',
    focusKey: 'team_focus_fullstack',
    stack: ['Node.js', 'Auth', 'CI/CD'],
  },
  {
    name: 'Дина Мырзагалиева',
    roleKey: 'team_role_ux_researcher',
    focusKey: 'team_focus_ux_researcher',
    stack: ['UX Labs', 'Interviews', 'i18n'],
  },
];

const leadershipTeam: TeamMember[] = [
  {
    name: 'Санжар Омаров',
    roleKey: 'team_role_product_manager',
    focusKey: 'team_focus_product_manager',
    stack: ['Roadmap', 'Analytics', 'Stakeholders'],
  },
  {
    name: 'Айгуль Касым',
    roleKey: 'team_role_operations_lead',
    focusKey: 'team_focus_operations_lead',
    stack: ['Rollout', 'Training', 'SLA'],
  },
  {
    name: 'Карина Абдуллина',
    roleKey: 'team_role_data_manager',
    focusKey: 'team_focus_data_manager',
    stack: ['ETL', 'Data QA', 'Governance'],
  },
  {
    name: 'Ермек Жан',
    roleKey: 'team_role_customer_success',
    focusKey: 'team_focus_customer_success',
    stack: ['Feedback', 'Workshops', 'Support'],
  },
];

const TeamPage: React.FC = () => {
  const { t } = useTranslation();

  const stats = [
    { value: '18', label: t('team_stats_deployments') },
    { value: '42', label: t('team_stats_coverage') },
    { value: '12', label: t('team_stats_partners') },
  ];

  return (
    <div className="team-page">
      <section className="team-hero">
        <p className="team-kicker">{t('team_kicker')}</p>
        <h1>{t('team_page_title')}</h1>
        <p className="team-subtitle">{t('team_page_subtitle')}</p>
        <div className="team-stats">
          {stats.map((stat) => (
            <div className="team-stat" key={stat.label}>
              <span className="team-stat-value">{stat.value}</span>
              <span className="team-stat-label">{stat.label}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="team-section">
        <div className="team-section-header">
          <h2>{t('team_section_developers')}</h2>
          <p>{t('team_section_developers_desc')}</p>
        </div>
        <div className="team-grid">
          {developerTeam.map((member) => (
            <article className="team-card" key={member.name}>
              <div className="team-card-header">
                <h3>{member.name}</h3>
                <span>{t(member.roleKey)}</span>
              </div>
              <p className="team-card-focus">{t(member.focusKey)}</p>
              <div className="team-card-stack">
                {member.stack.map((skill) => (
                  <span key={`${member.name}-${skill}`}>{skill}</span>
                ))}
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="team-section">
        <div className="team-section-header">
          <h2>{t('team_section_managers')}</h2>
          <p>{t('team_section_managers_desc')}</p>
        </div>
        <div className="team-grid">
          {leadershipTeam.map((member) => (
            <article className="team-card" key={member.name}>
              <div className="team-card-header">
                <h3>{member.name}</h3>
                <span>{t(member.roleKey)}</span>
              </div>
              <p className="team-card-focus">{t(member.focusKey)}</p>
              <div className="team-card-stack">
                {member.stack.map((skill) => (
                  <span key={`${member.name}-${skill}`}>{skill}</span>
                ))}
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="team-values">
        <div className="team-values-header">
          <h2>{t('team_values_title')}</h2>
        </div>
        <div className="team-values-grid">
          <article className="team-value-card">
            <Sparkles size={28} />
            <h3>{t('team_values_delivery')}</h3>
            <p>{t('team_values_delivery_desc')}</p>
          </article>
          <article className="team-value-card">
            <ShieldCheck size={28} />
            <h3>{t('team_values_support')}</h3>
            <p>{t('team_values_support_desc')}</p>
          </article>
          <article className="team-value-card">
            <Layers size={28} />
            <h3>{t('team_values_research')}</h3>
            <p>{t('team_values_research_desc')}</p>
          </article>
        </div>
      </section>

      <section className="team-contact">
        <div>
          <h3>{t('team_contact_cta')}</h3>
          <p>{t('team_contact_note')}</p>
        </div>
        <a
          className="team-contact-button"
          href="mailto:science@minedu.kz"
          aria-label={`${t('team_contact_button')} science@minedu.kz`}
        >
          <Mail size={18} aria-hidden="true" />
          <span>{t('team_contact_button')}</span>
        </a>
      </section>
    </div>
  );
};

export default TeamPage;
