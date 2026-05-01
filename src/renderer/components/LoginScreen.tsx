import React, { useState } from 'react';

interface Props {
  onLogin: (user: { id: number; username: string; displayName: string; role: string }) => void;
  appVersion?: string;
}

export default function LoginScreen({ onLogin, appVersion }: Props) {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!username.trim() || !password.trim()) {
      setError('아이디와 비밀번호를 입력해주세요.');
      return;
    }
    if (mode === 'register' && !displayName.trim()) {
      setError('이름을 입력해주세요.');
      return;
    }

    setIsLoading(true);
    try {
      if (mode === 'login') {
        const result = await (window as any).api.login({ username, password });
        onLogin(result.user);
      } else {
        const result = await (window as any).api.register({ username, password, displayName });
        onLogin(result.user);
      }
    } catch (err: any) {
      setError(err.message || (mode === 'login' ? '로그인에 실패했습니다.' : '회원가입에 실패했습니다.'));
    } finally {
      setIsLoading(false);
    }
  };

  const switchMode = () => {
    setMode(mode === 'login' ? 'register' : 'login');
    setError('');
  };

  return (
    <div className="login-screen">
      <div className="login-card">
        <div className="login-header">
          <h1 className="login-brand">Mong</h1>
          <p className="login-subtitle">
            AI 자소서 컨설팅
            {appVersion && <span style={{ marginLeft: '8px', fontSize: '12px', opacity: 0.6 }}>v{appVersion}</span>}
          </p>
        </div>

        <form onSubmit={handleSubmit}>
          {error && <div className="login-error">{error}</div>}

          {mode === 'register' && (
            <div className="form-group">
              <label>이름</label>
              <input value={displayName} onChange={(e) => setDisplayName(e.target.value)}
                placeholder="표시될 이름" autoFocus />
            </div>
          )}

          <div className="form-group">
            <label>아이디</label>
            <input value={username} onChange={(e) => setUsername(e.target.value)}
              placeholder="아이디" autoFocus={mode === 'login'} />
          </div>

          <div className="form-group">
            <label>비밀번호</label>
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)}
              placeholder="비밀번호" />
          </div>

          <button type="submit" className="btn btn-primary login-btn" disabled={isLoading}>
            {isLoading ? '처리 중...' : mode === 'login' ? '로그인' : '가입하기'}
          </button>
        </form>

        <div className="login-switch">
          {mode === 'login' ? (
            <>계정이 없으신가요? <button onClick={switchMode}>회원가입</button></>
          ) : (
            <>이미 계정이 있으신가요? <button onClick={switchMode}>로그인</button></>
          )}
        </div>
      </div>
    </div>
  );
}
