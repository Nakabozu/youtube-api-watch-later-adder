<script>
    import { cT, ansiR, gT } from '$lib/ansiCodes';
    import { onMount } from 'svelte';
    const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_OAUTH_CLIENT_ID;
    const GOOGLE_OAUTH_CLIENT_SECRET = import.meta.env
        .VITE_GOOGLE_OAUTH_CLIENT_SECRET;
    const REDIRECT_URI = import.meta.env.VITE_REDIRECT_URI;
    const YOUTUBE_API_KEY = import.meta.env.VITE_YOUTUBE_API_KEY;
    const SIIVAGUNNER_CHANNEL_ID = import.meta.env.VITE_SIIVAGUNNER_CHANNEL_ID;
    const STARTING_TIMESTAMP = import.meta.env.VITE_STARTING_TIMESTAMP;
    const YOUTUBE_PLAYLIST_ID = import.meta.env.VITE_YOUTUBE_PLAYLIST_ID;

    let { data } = $props();

    const authorizationScope = 'https://www.googleapis.com/auth/youtube';
    const authorizationUrl =
        `https://accounts.google.com/o/oauth2/v2/auth` +
        `?client_id=${GOOGLE_CLIENT_ID}` +
        `&redirect_uri=${REDIRECT_URI}` +
        `&scope=${authorizationScope}` +
        `&response_type=token` +
        `&state=YouDidIt`;
    // + `&prompt=consent`;

    let authCode = $state(data?.code);
    let accessToken = $state(data?.accessToken);
    let videosToAdd = $state([]);

    onMount(() => {
        if (sessionStorage.getItem('videosToAdd')) {
            videosToAdd = JSON.parse(sessionStorage.getItem('videosToAdd'));
        }
    });

    /**
     * Recursively loops through the YouTube Search API to get all videos uploaded after the given `startingTimestamp`.
     * @param {{startingTimestamp: string, nextChannelSearchPageToken: string}} params
     */
    const getVideosToAdd = async (
        startingTimestamp,
        nextChannelSearchPageToken
    ) => {
        console.log(`${cT}Getting videos...${ansiR}`);
        let finalUrl =
            `https://youtube.googleapis.com/youtube/v3/search` +
            `?key=${YOUTUBE_API_KEY}` +
            `&channelId=${SIIVAGUNNER_CHANNEL_ID}` +
            `&part=snippet` +
            `&maxResults=50` +
            `&order=date` +
            `&type=video` +
            `&publishedAfter=${startingTimestamp}`;
        if (nextChannelSearchPageToken) {
            finalUrl += `&pageToken=${nextChannelSearchPageToken}`;
        }

        return await fetch(finalUrl)
            .then((res) => {
                if (res.ok) {
                    return res.json();
                } else {
                    throw new Error('Network response was not ok.');
                }
            })
            .then(async (data) => {
                // Check if the response contains items
                if (data.items && data.items.length > 0) {
                    // PROCESS ITEMS HERE
                    // Check if there is a next page token
                    if (data?.nextPageToken) {
                        const nextVideosToAdd = console.log(
                            `${cT}Looping again...${ansiR}`,
                            data.items
                        );
                        return [
                            ...data.items,
                            ...(await getVideosToAdd(
                                startingTimestamp,
                                data.nextPageToken
                            )),
                        ];
                    } else {
                        console.log(`${gT}DONE FINDING VIDEOS!${ansiR}`, data);
                        return [...data.items];
                    }
                } else {
                    console.log('No items found in the response.');
                    return [];
                }
            })
            .catch((error) => {
                console.error(`${cT}Error fetching data${ansiR}:`, error);
                return [];
            });
    };

    const addVideosToPlaylist = async (/** @type {any[]} */ vidsToAdd) => {
        if (vidsToAdd.length <= 0) {
            console.log('No videos to add.');
            return;
        }
        if (!videosToAdd[videosToAdd.length - 1]?.id?.videoId) {
            console.log(
                'No ID found for this video.  Ending Early.',
                videosToAdd[videosToAdd.length - 1]
            );
            return;
        }
        // Get the last video ID to add
        let finalUrl =
            `https://youtube.googleapis.com/youtube/v3/playlistItems` +
            `?part=snippet` +
            `&key=${YOUTUBE_API_KEY}`;
        fetch(finalUrl, {
            method: 'POST',
            body: JSON.stringify({
                snippet: {
                    playlistId: YOUTUBE_PLAYLIST_ID,
                    resourceId: {
                        kind: 'youtube#video',
                        videoId: vidsToAdd?.pop().id.videoId,
                    },
                },
            }),
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${accessToken}`,
            },
        })
            .then((res) => {
                if (res.ok) {
                    return res.json();
                } else {
                    throw new Error('Network response was not ok.');
                }
            })
            .then((data) => {
                console.log(
                    `${gT}Added ${data?.snippet?.title} to playlist!${ansiR} https://www.youtube.com/watch?v=${data?.id?.videoId}`
                );
                sessionStorage.setItem(
                    'videosToAdd',
                    JSON.stringify(vidsToAdd)
                );
                addVideosToPlaylist(vidsToAdd);
            })
            .catch((error) => {
                console.error('Error fetching data:', error);
            });
    };
</script>

<main
    style={'display: flex; flex-direction: column; gap: 1rem; justify-content: center; align-items: center;'}
>
    <h1>YouTube Watch Later Adder</h1>
    {#if !authCode && !accessToken}
        <h2>Authentication</h2>
        <a href={authorizationUrl}>
            <button>Authorize with Google</button>
        </a>
    {:else if authCode && !accessToken}
        <h2>Getting Access Token</h2>
        <p>Authorizing...</p>
        <p>Auth Code: {authCode}</p>
    {:else if accessToken && videosToAdd.length <= 0}
        <h2>Get Videos</h2>
        <p>Access Token: {accessToken}</p>
        <button
            onclick={async () => {
                videosToAdd = await getVideosToAdd(STARTING_TIMESTAMP);
                sessionStorage.setItem(
                    'videosToAdd',
                    JSON.stringify(videosToAdd)
                );
            }}
        >
            Start
        </button>
    {:else if videosToAdd.length > 0}
        <h2>Add Videos To Playlist</h2>
        <button
            onclick={async () => {
                await addVideosToPlaylist(videosToAdd);
            }}>Add To Playlist</button
        >
    {/if}
    <h2>DATA</h2>
    <div
        style={'display: grid; grid-template-columns: auto auto; gap: 0.5rem;'}
    >
        <b>GOOGLE_CLIENT_ID: </b>{GOOGLE_CLIENT_ID}
        <b>GOOGLE_OAUTH_CLIENT_SECRET: </b>{GOOGLE_OAUTH_CLIENT_SECRET}
        <b>REDIRECT_URI: </b>{REDIRECT_URI}
        <b>YOUTUBE_API_KEY: </b>{YOUTUBE_API_KEY}
        <b>YOUTUBE_PLAYLIST_ID: </b>{YOUTUBE_PLAYLIST_ID}
        <b>SIIVAGUNNER_CHANNEL_ID: </b>{SIIVAGUNNER_CHANNEL_ID}
        <b>STARTING_TIMESTAMP: </b>{STARTING_TIMESTAMP}
        <b>Backend Data: </b>{JSON.stringify(data, null, 2)}
        <b># of videosToAdd: </b>{videosToAdd.length}
    </div>
</main>

<style>
    button {
        padding: 0.5rem 1rem;
        border-radius: 0.5rem;
        background-color: #007bff;
        color: white;
        border: none;
        cursor: pointer;
        /* TEXT STYLING */
        font-size: 1rem;
        font-weight: 600;
        text-align: center;
        text-decoration: none;
        &:hover {
            background-color: #0056b3;
        }
        &:active {
            background-color: #004085;
        }
    }
</style>
