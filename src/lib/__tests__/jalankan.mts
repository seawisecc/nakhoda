import { ringkasan } from "./uji";

process.stdout.write("\nNakhoda, tes logika hitung\n\n");

await import("./posisi.test");
await import("./kinerja.test");
await import("./risiko.test");
await import("./tinjauan.test");
await import("./urai.test");
await import("./level.test");
await import("./format.test");

ringkasan();
