import { decryptToken } from '../integrations-crypto';
import { getIntegrationByProvider, updateIntegration } from '../integrations-db';

async function getGithubToken(): Promise<string | null> {
  const integration = await getIntegrationByProvider('github');
  if (!integration?.oauthTokens?.accessToken) return null;
  try {
    return decryptToken(integration.oauthTokens.accessToken);
  } catch {
    await updateIntegration(integration.id, { status: 'error' });
    return null;
  }
}

export async function createGithubIssue(
  owner: string,
  repo: string,
  title: string,
  body?: string,
  labels?: string[],
): Promise<{ id: number; number: number; html_url: string } | null> {
  const token = await getGithubToken();
  if (!token) return null;

  const res = await fetch(`https://api.github.com/repos/${owner}/${repo}/issues`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Accept': 'application/vnd.github+json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ title, body: body || '', labels: labels || [] }),
  });

  if (!res.ok) return null;

  const data = await res.json();
  return { id: data.id, number: data.number, html_url: data.html_url };
}

export async function listGithubRepos(): Promise<{ id: number; name: string; full_name: string }[]> {
  const token = await getGithubToken();
  if (!token) return [];

  const res = await fetch('https://api.github.com/user/repos?sort=updated&per_page=30', {
    headers: {
      'Authorization': `Bearer ${token}`,
      'Accept': 'application/vnd.github+json',
    },
  });

  if (!res.ok) return [];

  const data = await res.json();
  return (data || []).map((r: any) => ({
    id: r.id,
    name: r.name,
    full_name: r.full_name,
  }));
}

export async function listGithubIssues(
  owner: string,
  repo: string,
  state: 'open' | 'closed' | 'all' = 'open',
  perPage = 30,
): Promise<{ id: number; number: number; title: string; state: string; html_url: string; labels: string[] }[]> {
  const token = await getGithubToken();
  if (!token) return [];

  const res = await fetch(
    `https://api.github.com/repos/${owner}/${repo}/issues?state=${state}&per_page=${perPage}&sort=updated`,
    { headers: { 'Authorization': `Bearer ${token}`, 'Accept': 'application/vnd.github+json' } },
  );
  if (!res.ok) return [];

  const data = await res.json();
  return (data || []).filter((i: any) => !i.pull_request).map((i: any) => ({
    id: i.id,
    number: i.number,
    title: i.title,
    state: i.state,
    html_url: i.html_url,
    labels: (i.labels || []).map((l: any) => l.name),
  }));
}

export async function closeGithubIssue(
  owner: string,
  repo: string,
  issueNumber: number,
): Promise<boolean> {
  const token = await getGithubToken();
  if (!token) return false;

  const res = await fetch(`https://api.github.com/repos/${owner}/${repo}/issues/${issueNumber}`, {
    method: 'PATCH',
    headers: { 'Authorization': `Bearer ${token}`, 'Accept': 'application/vnd.github+json', 'Content-Type': 'application/json' },
    body: JSON.stringify({ state: 'closed' }),
  });

  return res.ok;
}

export async function createGithubComment(
  owner: string,
  repo: string,
  issueNumber: number,
  body: string,
): Promise<{ id: number; html_url: string } | null> {
  const token = await getGithubToken();
  if (!token) return null;

  const res = await fetch(`https://api.github.com/repos/${owner}/${repo}/issues/${issueNumber}/comments`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${token}`, 'Accept': 'application/vnd.github+json', 'Content-Type': 'application/json' },
    body: JSON.stringify({ body }),
  });

  if (!res.ok) return null;
  const data = await res.json();
  return { id: data.id, html_url: data.html_url };
}

export async function addGithubLabels(
  owner: string,
  repo: string,
  issueNumber: number,
  labels: string[],
): Promise<boolean> {
  const token = await getGithubToken();
  if (!token) return false;

  const res = await fetch(`https://api.github.com/repos/${owner}/${repo}/issues/${issueNumber}/labels`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${token}`, 'Accept': 'application/vnd.github+json', 'Content-Type': 'application/json' },
    body: JSON.stringify({ labels }),
  });

  return res.ok;
}

// ============================================
// PULL REQUESTS
// ============================================

export async function listPullRequests(
  owner: string,
  repo: string,
  state: 'open' | 'closed' | 'all' = 'open',
  perPage = 30,
): Promise<{ id: number; number: number; title: string; state: string; html_url: string; merged: boolean; user: string; head: string; base: string }[]> {
  const token = await getGithubToken();
  if (!token) return [];

  const res = await fetch(
    `https://api.github.com/repos/${owner}/${repo}/pulls?state=${state}&per_page=${perPage}&sort=updated`,
    { headers: { 'Authorization': `Bearer ${token}`, 'Accept': 'application/vnd.github+json' } },
  );
  if (!res.ok) return [];

  const data = await res.json();
  return (data || []).map((pr: any) => ({
    id: pr.id,
    number: pr.number,
    title: pr.title,
    state: pr.state,
    html_url: pr.html_url,
    merged: pr.merged || false,
    user: pr.user?.login || '',
    head: pr.head?.ref || '',
    base: pr.base?.ref || '',
  }));
}

export async function getPullRequest(
  owner: string,
  repo: string,
  prNumber: number,
): Promise<{ id: number; number: number; title: string; state: string; html_url: string; merged: boolean; body: string; user: string; additions: number; deletions: number; changed_files: number } | null> {
  const token = await getGithubToken();
  if (!token) return null;

  const res = await fetch(
    `https://api.github.com/repos/${owner}/${repo}/pulls/${prNumber}`,
    { headers: { 'Authorization': `Bearer ${token}`, 'Accept': 'application/vnd.github+json' } },
  );
  if (!res.ok) return null;

  const pr = await res.json();
  return {
    id: pr.id,
    number: pr.number,
    title: pr.title,
    state: pr.state,
    html_url: pr.html_url,
    merged: pr.merged || false,
    body: pr.body || '',
    user: pr.user?.login || '',
    additions: pr.additions || 0,
    deletions: pr.deletions || 0,
    changed_files: pr.changed_files || 0,
  };
}

// ============================================
// COMMITS
// ============================================

export async function listCommits(
  owner: string,
  repo: string,
  sha?: string,
  perPage = 30,
): Promise<{ sha: string; message: string; author: string; date: string; html_url: string }[]> {
  const token = await getGithubToken();
  if (!token) return [];

  const params = new URLSearchParams({ per_page: String(perPage) });
  if (sha) params.set('sha', sha);

  const res = await fetch(
    `https://api.github.com/repos/${owner}/${repo}/commits?${params}`,
    { headers: { 'Authorization': `Bearer ${token}`, 'Accept': 'application/vnd.github+json' } },
  );
  if (!res.ok) return [];

  const data = await res.json();
  return (data || []).map((c: any) => ({
    sha: c.sha,
    message: c.commit?.message || '',
    author: c.commit?.author?.name || c.author?.login || '',
    date: c.commit?.author?.date || '',
    html_url: c.html_url,
  }));
}

// ============================================
// CHECK RUNS (CI STATUS)
// ============================================

export async function getCheckRuns(
  owner: string,
  repo: string,
  ref: string,
): Promise<{ id: number; name: string; status: string; conclusion: string | null; html_url: string }[]> {
  const token = await getGithubToken();
  if (!token) return [];

  const res = await fetch(
    `https://api.github.com/repos/${owner}/${repo}/commits/${ref}/check-runs`,
    { headers: { 'Authorization': `Bearer ${token}`, 'Accept': 'application/vnd.github+json' } },
  );
  if (!res.ok) return [];

  const data = await res.json();
  return (data.check_runs || []).map((cr: any) => ({
    id: cr.id,
    name: cr.name,
    status: cr.status,
    conclusion: cr.conclusion,
    html_url: cr.html_url,
  }));
}
