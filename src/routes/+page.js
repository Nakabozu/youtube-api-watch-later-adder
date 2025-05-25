
export const load = ({ params, url }) => {
	return {
		code: url.searchParams.get('code'),
        accessToken: url.searchParams.get('access_token'),
	};
};