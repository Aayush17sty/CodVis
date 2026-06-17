package main

func getCurrent(session *Session) Snapshot {
	return session.Snapshots[session.Current]
}

func next(session *Session) Snapshot {
	if session.Current < len(session.Snapshots)-1 {
		session.Current++
	}
	return session.Snapshots[session.Current]
}

func prev(session *Session) Snapshot {
	if session.Current > 0 {
		session.Current--
	}
	return session.Snapshots[session.Current]
}

func jump(session *Session, index int) Snapshot {
	if index >= 0 && index < len(session.Snapshots) {
		session.Current = index
	}
	return session.Snapshots[session.Current]
}
