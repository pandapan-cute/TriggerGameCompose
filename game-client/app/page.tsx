import Image from "next/image";
import { Noto_Sans_JP, Orbitron } from "next/font/google";
import styles from "./index.module.css";
import { SkyOutlineButton } from "@/components/buttons/sky-outline";
import { WhiteFillButton } from "@/components/buttons/white-fill";

const orbitron = Orbitron({
  subsets: ["latin"],
  weight: ["500", "700"],
});

const notoSansJp = Noto_Sans_JP({
  subsets: ["latin"],
  weight: ["400", "500", "700"],
});

export default function TopPage() {
  return (
    <main className={`${styles.page} ${notoSansJp.className}`}>
      <section className={styles.heroSection}>
        <div className={styles.heroContent}>
          <Image
            src="/logos/Logo_top_plain.svg"
            alt="Hero Image"
            width={1000}
            height={400}
            sizes="(max-width: 800px) 100vw, 800px"
            className={styles.pageLogo}
          />
          <p className={styles.catchCopy}>戦闘シミュレーション演習に挑戦せよ</p>
          <div className={styles.heroButtons}>
            <WhiteFillButton href="/pve-lobby">
              AIとの演習 | PvE
            </WhiteFillButton>
            <WhiteFillButton href="/lobby">
              オンライン対戦 | PvP
            </WhiteFillButton>
          </div>
        </div>
        <div className={styles.heroSkew} />
      </section>

      <section className={styles.featureSection}>
        <div className={styles.topAccent}>
          <p className={`${styles.featureNumber} ${orbitron.className}`}>01</p>
          <h2 className={styles.featureTitle}>六角形グリッドが舞台の戦略シミュレーション</h2>
        </div>
        <div className={styles.featureGrid}>
          <div className={styles.featureTextBlock}>
            <p className={styles.featureBody}>
              大人気漫画ワールドトリガーで進行中の「遠征選抜試験編」内に登場する<br />
              [戦闘シミュレーション演習]をもとにしたゲームです<br />
              (非公式のファンメイクゲームです)
            </p>
            <p className={styles.featureBody}>
              原作さながらのキャラクター移動、トリガー設定、
              両プレイヤーユニットの同時行動が楽しめます。
            </p>
            <p className={styles.featureBody}>
              原作に登場した戦術を再現するもよし<br />
              オリジナルの戦術を考えるもよし<br />
              ぜひ、プレイしてみてください！
            </p>
          </div>
          <Image
            src="/images/capture01.png"
            alt="Feature Image"
            width={600}
            height={400}
            className={styles.featureImage}
          />
        </div>
        <div className={styles.heroSkew} />
      </section>

      <section className={`${styles.featureSection} ${styles.featureSectionSecondary}`}>
        <div className={styles.topAccent}>
          <p className={`${styles.featureNumber} ${orbitron.className}`}>02</p>
          <h2 className={styles.featureTitle}>オープンソース開発による新たな可能性</h2>
        </div>
        <div className={styles.featureGrid}>
          <div className={styles.featureTextBlock}>
            <p className={styles.featureBody}>
              原作を読んだあなたならわかるはず<br />
              「このゲームで採算を取るのは難しい」<br />
              だからこそ、オープンソース開発に挑戦してみました。
            </p>
            <p className={styles.featureBody}>
              ゲームのソースコードはGitHubで公開されており、<br />
              誰でも自由に開発に参加できます。
            </p>
            <p className={styles.featureBody}>
              バグ修正や機能追加、さらには新しいゲームモードの提案など、
              あなたのアイデアがゲームをより面白くするかもしれません。
            </p>
            <p className={styles.featureBody}>
              また、サーバーレスアーキテクチャを採用し<br />
              サーバー代という固定費のかからない持続可能な設計としています
            </p>
            <div className={styles.ctaRow}>
              <SkyOutlineButton href="https://github.com/users/pandapan-cute/projects/2">GitHubプロジェクトへ</SkyOutlineButton>
            </div>
          </div>
          <Image
            src="/images/capture02.png"
            alt="Feature Image"
            width={500}
            height={500}
            className={styles.featureImage}
          />
        </div>
      </section>

      <section className={styles.bottomAccent} />

      <footer className={styles.footer}>
        <small>© 2026 World Trigger Grid Field</small>
        <nav className={styles.footerLinks}>
          <a href="https://x.com/pandapan_cute" aria-label="X">X</a>
          <a href="https://github.com/pandapan-cute/TriggerGameCompose" aria-label="GitHub">GitHub</a>
        </nav>
      </footer>
    </main>
  );
}
