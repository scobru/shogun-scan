import { user } from 'lonewolf-protocol';
import { createSignal, onMount } from 'solid-js';
import BackButton from '../../components/buttons/back';

const ProfilePage = ({ backEnabled }) => {
  const [displayName, setDisplayName] = createSignal('');
  const [bio, setBio] = createSignal('');
  const [isEditing, setIsEditing] = createSignal(false);

  onMount(() => {
    // Carica i dati del profilo
    setDisplayName(user.displayName || '');
    setBio(user.bio || '');
  });

  const handleSave = () => {
    user.updateProfile(
      {
        displayName: displayName(),
        bio: bio(),
      },
      ({ errMessage, success }) => {
        if (errMessage) console.error(errMessage);
        else {
          console.log(success);
          setIsEditing(false);
        }
      }
    );
  };

  return (
    <div class="flex flex-col h-full bg-gray-900">
      <div class="flex items-center justify-between px-6 py-4 border-b border-gray-800">
        <div class="flex items-center space-x-4">
          {backEnabled && <BackButton class="text-gray-400 hover:text-violet-500" />}
          <h1 class="text-xl font-medium text-gray-100">Profilo</h1>
        </div>
        <button
          onClick={() => setIsEditing(!isEditing())}
          class="text-violet-500 hover:text-violet-400"
        >
          {isEditing() ? 'Annulla' : 'Modifica'}
        </button>
      </div>

      <div class="flex-1 p-6 space-y-6">
        {/* Avatar e info principali */}
        <div class="flex items-center space-x-4">
          <div class="w-20 h-20 bg-gray-800 rounded-full overflow-hidden">
            <img
              src={`https://avatars.dicebear.com/api/identicon/${user.is?.pub}.svg`}
              alt="Profile"
              class="w-full h-full object-cover"
            />
          </div>
          <div>
            {isEditing() ? (
              <input
                type="text"
                value={displayName()}
                onInput={(e) => setDisplayName(e.target.value)}
                class="bg-gray-800 text-gray-100 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-violet-500"
                placeholder="Il tuo nome"
              />
            ) : (
              <h2 class="text-xl font-medium text-gray-100">
                {displayName() || 'Nessun nome impostato'}
              </h2>
            )}
            <p class="text-sm text-gray-400">@{user.is?.alias}</p>
          </div>
        </div>

        {/* Bio */}
        <div class="space-y-2">
          <label class="block text-sm font-medium text-gray-400">Bio</label>
          {isEditing() ? (
            <textarea
              value={bio()}
              onInput={(e) => setBio(e.target.value)}
              class="w-full h-32 bg-gray-800 text-gray-100 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-violet-500"
              placeholder="Scrivi qualcosa su di te..."
            />
          ) : (
            <p class="text-gray-300">{bio() || 'Nessuna bio impostata'}</p>
          )}
        </div>

        {/* Chiave pubblica */}
        <div class="space-y-2">
          <label class="block text-sm font-medium text-gray-400">Chiave pubblica</label>
          <div class="bg-gray-800 rounded-lg p-4">
            <p class="text-sm text-gray-300 break-all font-mono">
              {user.is?.pub || 'Non disponibile'}
            </p>
          </div>
        </div>

        {/* Pulsante salva */}
        {isEditing() && (
          <button
            onClick={handleSave}
            class="w-full bg-violet-600 hover:bg-violet-700 text-white font-medium py-2 px-4 rounded-lg transition-colors duration-200"
          >
            Salva modifiche
          </button>
        )}
      </div>
    </div>
  );
};

export default ProfilePage;
