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
    <div class="flex flex-col h-full dark:bg-signal-background-dark bg-white">
      <div class="flex items-center justify-between px-6 py-4 border-b dark:border-signal-border-dark border-signal-border-light">
        <div class="flex items-center space-x-4">
          {backEnabled && <BackButton class="dark:text-signal-text-muted-dark text-signal-text-muted-light hover:text-signal-blue" />}
          <h1 class="text-xl font-medium dark:text-signal-text-dark text-signal-text-light">Profilo</h1>
        </div>
        <button
          onClick={() => setIsEditing(!isEditing())}
          class="text-signal-blue hover:text-signal-blue-light rounded-md px-3 py-1.5 text-sm font-medium transition-colors"
        >
          {isEditing() ? 'Annulla' : 'Modifica'}
        </button>
      </div>

      <div class="flex-1 p-6 space-y-6">
        {/* Avatar e info principali */}
        <div class="flex items-center space-x-5">
          <div class="w-20 h-20 dark:bg-signal-surface-dark bg-signal-surface-light rounded-full overflow-hidden border-2 border-signal-blue">
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
                class="dark:bg-signal-surface-dark bg-signal-surface-light dark:text-signal-text-dark text-signal-text-light rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-signal-blue border dark:border-signal-border-dark border-signal-border-light"
                placeholder="Il tuo nome"
              />
            ) : (
              <h2 class="text-xl font-medium dark:text-signal-text-dark text-signal-text-light">
                {displayName() || 'Nessun nome impostato'}
              </h2>
            )}
            <p class="text-sm dark:text-signal-text-muted-dark text-signal-text-muted-light mt-1">@{user.is?.alias}</p>
          </div>
        </div>

        {/* Bio */}
        <div class="space-y-2">
          <label class="block text-sm font-medium dark:text-signal-text-muted-dark text-signal-text-muted-light">Bio</label>
          {isEditing() ? (
            <textarea
              value={bio()}
              onInput={(e) => setBio(e.target.value)}
              class="w-full h-32 dark:bg-signal-surface-dark bg-signal-surface-light dark:text-signal-text-dark text-signal-text-light rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-signal-blue border dark:border-signal-border-dark border-signal-border-light"
              placeholder="Scrivi qualcosa su di te..."
            />
          ) : (
            <div class="dark:bg-signal-surface-dark bg-signal-surface-light rounded-lg p-4 border dark:border-signal-border-dark border-signal-border-light">
              <p class="dark:text-signal-text-dark text-signal-text-light">
                {bio() || 'Nessuna bio impostata'}
              </p>
            </div>
          )}
        </div>

        {/* Chiave pubblica */}
        <div class="space-y-2">
          <label class="block text-sm font-medium dark:text-signal-text-muted-dark text-signal-text-muted-light">Chiave pubblica</label>
          <div class="dark:bg-signal-surface-dark bg-signal-surface-light rounded-lg p-4 border dark:border-signal-border-dark border-signal-border-light">
            <p class="text-sm dark:text-signal-text-dark text-signal-text-light break-all font-mono">
              {user.is?.pub || 'Non disponibile'}
            </p>
          </div>
        </div>

        {/* Pulsante salva */}
        {isEditing() && (
          <button
            onClick={handleSave}
            class="w-full bg-signal-blue hover:bg-signal-blue-light text-white font-medium py-2.5 px-4 rounded-lg transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-signal-blue focus:ring-offset-signal-background-dark"
          >
            Salva modifiche
          </button>
        )}
      </div>
    </div>
  );
};

export default ProfilePage;
