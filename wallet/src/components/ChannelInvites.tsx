import React from 'react';

interface ChannelInvite {
  key: string;
  name: string;
  isPrivate: boolean;
  owner: string;
  invitedBy: string;
  invitedByName: string;
  timestamp: number;
}

interface ChannelInvitesProps {
  invites: ChannelInvite[];
  onAccept: (invite: ChannelInvite) => Promise<void>;
  onReject: (invite: ChannelInvite) => Promise<void>;
}

const ChannelInvites: React.FC<ChannelInvitesProps> = ({ 
  invites = [],
  onAccept, 
  onReject 
}) => {
  if (!invites || invites.length === 0) {
    return (
      <div className="text-center text-gray-400 p-4">
        Nessun invito a canali
      </div>
    );
  }
  
  return (
    <div className="divide-y divide-white/5">
      {invites.map((invite) => (
        <div key={invite.key} className="p-4">
          <div className="flex justify-between items-start mb-2">
            <div>
              <div className="font-medium">{invite.name}</div>
              <div className="text-xs text-gray-400">
                Invitato da {invite.invitedByName}
              </div>
              <div className="text-xs text-gray-400 mt-1">
                {new Date(invite.timestamp).toLocaleString()}
              </div>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => onAccept(invite)}
                className="px-3 py-1 bg-primary text-white rounded-lg text-sm hover:bg-primary/80"
              >
                Accetta
              </button>
              <button
                onClick={() => onReject(invite)}
                className="px-3 py-1 bg-white/10 rounded-lg text-sm hover:bg-white/20"
              >
                Rifiuta
              </button>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};

export default ChannelInvites; 