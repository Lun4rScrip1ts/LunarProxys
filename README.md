<div align="center">
    <img src="https://raw.githubusercontent.com/Lun4rScrip1ts/LunarProxys/main/static/assets/media/favicon/main.png">
    <p>Serving over 15 million users since 2022.<p>
    <p>Lunar Proxy is a clean, sleek web proxy with an easy-to-use interface designed for a smooth browsing experience.</p>
</div>

![inpreview](https://raw.githubusercontent.com/Lun4rScrip1ts/LunarProxys/main/static/assets/media/favicon/main.png)

> [!IMPORTANT]
> If you fork this project, consider giving it a star in the original repository!

**Join the [Lunar Lounge](https://discord.gg/lunarslounge) for support, updates, and community help!**

## Features

- About:Blank Cloaking
- Tab Cloaking
- Wide collection of apps & games
- Clean, Easy to use UI
- Inspect Element
- Various Themes
- Password Protection (Optional)
- Built-in Tab System
- Now.gg Support
- Fast Speeds
- Geforce NOW Support

## Deployment

> [!IMPORTANT]
> You **cannot** deploy to static web hosts, including Netlify, Cloudflare Pages, and GitHub Pages.

### Password Protection

1. Go to the `config.js` file and set `challenge` to **true**. Then, set the environment variable as follows:
2. For PNPM: Run either `config=true pnpm start` or `$env:config=true; pnpm start`, depending on your server.
3. For Bun: Run either `config=true bun start` or `$env:config=true; bun start` if you prefer Bun.
4. For NPM: Run either `config=true npm start` or `$env:config=true; npm start` if you prefer NPM.


### Server Deployment

You must run these commands on your server:

```bash
git clone https://github.com/Lun4rScrip1ts/LunarProxys
cd LunarProxys
```

#### Ad-Free Deployment

```bash
git clone --branch Ad-Free https://github.com/UseInterstellar/Interstellar
cd LunarProxys
```

Next depending on your package manager, run one of the following commands:

#### Bun

If you are using Bun, run the following commands:

```bash
bun i
bun start
```

#### pnpm

If you are using pnpm, run the following commands:

```bash
pnpm i
pnpm start
```

#### npm

If you are using npm, run the following commands:

```bash
npm i
npm run start
```

### Updating

```bash
cd LunarProxys
git pull --force --allow-unrelated-histories # This may overwrite your local changes
```

<a target="_blank" href="https://heroku.com/deploy/?template=https://github.com/Lun4rScrip1ts/LunarProxys"><img alt="Deploy to Heroku" src="https://binbashbanana.github.io/deploy-buttons/buttons/remade/heroku.svg"></a>
<a target="_blank" href="https://app.koyeb.com/deploy?type=git&repository=github.com/Lun4rScrip1ts/LunarProxys"><img alt="Deploy to Koyeb" src="https://binbashbanana.github.io/deploy-buttons/buttons/remade/koyeb.svg"></a>

### Deployment Alternatives

For more deployment options, join the [Lunar Lounge](https://discord.gg/lunarslounge) for deployment help and community support.
This includes methods of deploying to Render/OnRender.

#### What happened to Replit Deployment?

As of January 1st, 2024, Replit is [no longer free](https://blog.replit.com/hosting-changes). Try GitHub Codespaces instead.

### GitHub Codespaces

> [!NOTE]
> If you're setting the port below 1023, then you must run `sudo PORT=1023`

1. Create a GitHub account if you haven't already.
2. Click "Code" (green button) and then "Create Codespace on main."
3. In the terminal at the bottom, paste `pnpm i && pnpm start`.
4. Respond to the application popup by clicking "Make public."
> [!IMPORTANT]
> Make sure you click the "Make public." button, or the proxy won't function properly.<br>
> If you get a Range Error, go back and make sure you clicked Make public!
5. Access the deployed website from the ports tab.
6. For subsequent uses in the same codespace, just run `pnpm start`

### Solution for if there is no popup.

1. Run `pnpm i`, and before `pnpm start`, prepend `PORT=8080`, replacing 8080 with another port. For example, `PORT=6969 pnpm start`.
2. If this does not work then you can prepend `$env:PORT=8080;`, replacing 8080 with another port. For example, `$env:PORT=6969; pnpm start`
3. Go to the ports tab, Click Forward A Port, And type the port number.
4. Right-click Visibility and set Port Visibility to Public.

> [!NOTE]
> We are committed to making Lunar Proxy easy and personalized however, as of now we need your support in making it ad-free. Consider keeping ads so Interstellar can run freely or contribute by being a supporter.

## Report Issues

If you encounter problems, open an issue on GitHub, and we'll address it promptly.

> [!TIP]
> If you're having trouble, don't hesitate to reach out to us on [Discord](https://discord.gg/lunarslounge) for personalized support.

# Credits

A huge thanks goes out to all of the people who have contributed to Lunar Proxy.

[![Contributors](https://contrib.rocks/image?repo=Lun4rScrip1ts/LunarProxys)](https://github.com/Lun4rScrip1ts/LunarProxys/graphs/contributors)
