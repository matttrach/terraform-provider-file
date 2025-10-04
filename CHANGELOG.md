# Changelog

## [2.0.3](https://github.com/matttrach/terraform-provider-file/compare/v2.0.2...v2.0.3) (2025-10-04)


### Bug Fixes

* fix release and release candidate race ([#221](https://github.com/matttrach/terraform-provider-file/issues/221)) ([#224](https://github.com/matttrach/terraform-provider-file/issues/224)) ([5e03c25](https://github.com/matttrach/terraform-provider-file/commit/5e03c25da8e9e3c20ceb5f678f81bc4a9d97fe65))

## [2.0.2](https://github.com/rancher/terraform-provider-file/compare/v2.0.1...v2.0.2) (2025-10-03)


### Bug Fixes

* remove all to prevent missing file errors ([#216](https://github.com/rancher/terraform-provider-file/issues/216)) ([#219](https://github.com/rancher/terraform-provider-file/issues/219)) ([565e883](https://github.com/rancher/terraform-provider-file/commit/565e88370bb1ab36445f2be7c9a885d582c641ae))

## [2.0.1](https://github.com/rancher/terraform-provider-file/compare/v2.0.0...v2.0.1) (2025-10-02)


### Bug Fixes

* sort directory file info objects ([#209](https://github.com/rancher/terraform-provider-file/issues/209)) ([#212](https://github.com/rancher/terraform-provider-file/issues/212)) ([0772272](https://github.com/rancher/terraform-provider-file/commit/07722727ecdd0fff83afdb55d1a3a4d0bff758e1))

## [2.0.0](https://github.com/rancher/terraform-provider-file/compare/v1.1.1...v2.0.0) (2025-10-01)


### ⚠ BREAKING CHANGES

* Add local directory management ([#201](https://github.com/rancher/terraform-provider-file/issues/201)) (#204)

### Features

* Add local directory management ([#201](https://github.com/rancher/terraform-provider-file/issues/201)) ([#204](https://github.com/rancher/terraform-provider-file/issues/204)) ([6a781ea](https://github.com/rancher/terraform-provider-file/commit/6a781ea7fd67723bbfd9ab99a2db38d59df734e8))

## [1.1.1](https://github.com/rancher/terraform-provider-file/compare/v1.1.0...v1.1.1) (2025-09-20)


### Bug Fixes

* goreleaser tag race condition ([#188](https://github.com/rancher/terraform-provider-file/issues/188)) ([#191](https://github.com/rancher/terraform-provider-file/issues/191)) ([9a652a5](https://github.com/rancher/terraform-provider-file/commit/9a652a5d22f7e5019f691b3b436e784318050c58))

## [1.1.0](https://github.com/rancher/terraform-provider-file/compare/v1.0.0...v1.1.0) (2025-09-19)


### Features

* update flake ([#183](https://github.com/rancher/terraform-provider-file/issues/183)) ([#186](https://github.com/rancher/terraform-provider-file/issues/186)) ([fd8bd23](https://github.com/rancher/terraform-provider-file/commit/fd8bd232cd0b20fca859fc3fe97c8e7494b08f72))

## [1.0.0](https://github.com/rancher/terraform-provider-file/compare/v0.1.0...v1.0.0) (2025-09-19)


### Features

* add data sources and organize code ([#148](https://github.com/rancher/terraform-provider-file/issues/148)) ([b0b84c1](https://github.com/rancher/terraform-provider-file/commit/b0b84c140972cc32303c2ce588a16f3cf867525d))
* add snapshot compression and decompression ([#159](https://github.com/rancher/terraform-provider-file/issues/159)) ([fc79fb6](https://github.com/rancher/terraform-provider-file/commit/fc79fb629148d5d3333ec053e0f80173d8c6146d))
* add snapshots ([#153](https://github.com/rancher/terraform-provider-file/issues/153)) ([42322ba](https://github.com/rancher/terraform-provider-file/commit/42322babc8324adf304c9466f6b1ba39517ca588))
* make file and snapshot contents sensitive ([#163](https://github.com/rancher/terraform-provider-file/issues/163)) ([f9beb35](https://github.com/rancher/terraform-provider-file/commit/f9beb35bca9dbd2dbf04098f64a7a18e84b1f627))


### Bug Fixes

* abstract OS file functions ([#6](https://github.com/rancher/terraform-provider-file/issues/6)) ([3ad0663](https://github.com/rancher/terraform-provider-file/commit/3ad0663037a4d1892a576f7181d5c9a8daaa36d8))
* add a new workflow for release candidates ([#93](https://github.com/rancher/terraform-provider-file/issues/93)) ([f50cbce](https://github.com/rancher/terraform-provider-file/commit/f50cbceeeeeb177fc4504bb5a639a042e5b09258))
* add automation to generate sub issues ([#7](https://github.com/rancher/terraform-provider-file/issues/7)) ([5f092ac](https://github.com/rancher/terraform-provider-file/commit/5f092ac3528b11da66e52ebaa05783f7d4967544))
* add back port pr ([#27](https://github.com/rancher/terraform-provider-file/issues/27)) ([f11e0f2](https://github.com/rancher/terraform-provider-file/commit/f11e0f2d0f56e583315447695c15c4159893a134))
* add checkout action before release please ([#101](https://github.com/rancher/terraform-provider-file/issues/101)) ([eb61848](https://github.com/rancher/terraform-provider-file/commit/eb6184873ccfda7367f605bbe2fbc5b032990e38))
* add console line converting object to string ([#42](https://github.com/rancher/terraform-provider-file/issues/42)) ([91ed4c1](https://github.com/rancher/terraform-provider-file/commit/91ed4c1e6d92d90b46ead078b1a775ad311ee602))
* add console line to see context ([#13](https://github.com/rancher/terraform-provider-file/issues/13)) ([b22c62a](https://github.com/rancher/terraform-provider-file/commit/b22c62a00d0ebb2292a36f3b49b58e71732b86e7))
* add console log to check context ([#38](https://github.com/rancher/terraform-provider-file/issues/38)) ([f7af5f9](https://github.com/rancher/terraform-provider-file/commit/f7af5f97cdff11919a361467df7d00e273a866c5))
* add manual backport workflow ([#128](https://github.com/rancher/terraform-provider-file/issues/128)) ([c57fe6a](https://github.com/rancher/terraform-provider-file/commit/c57fe6af0289d48f88984127897ad84327beff61))
* add release secrets from vault ([#2](https://github.com/rancher/terraform-provider-file/issues/2)) ([e5ffcc1](https://github.com/rancher/terraform-provider-file/commit/e5ffcc11a56d3b4d38fdbed0ecdb02edc587e7af))
* add team members individually to issue ([#40](https://github.com/rancher/terraform-provider-file/issues/40)) ([da1738b](https://github.com/rancher/terraform-provider-file/commit/da1738bbb0598cf3102709f1c24465cb1e9b5bc1))
* add write access to the actions permission ([#63](https://github.com/rancher/terraform-provider-file/issues/63)) ([c4c615a](https://github.com/rancher/terraform-provider-file/commit/c4c615ade0197f44adaaaac138b06f96e464d206))
* assign users to main pr ([#25](https://github.com/rancher/terraform-provider-file/issues/25)) ([ade5add](https://github.com/rancher/terraform-provider-file/commit/ade5addd2bc38b9694aa1a873cea1db8305d8245))
* backport PR need individual assignees ([#88](https://github.com/rancher/terraform-provider-file/issues/88)) ([66b964f](https://github.com/rancher/terraform-provider-file/commit/66b964f45ca543816423bdc41cc0d0bee73ccd58))
* bump action dependencies ([0533008](https://github.com/rancher/terraform-provider-file/commit/0533008f61d18a96f9107221c4df260280919a70))
* bump dependency from 8 to 27 in tools ([#29](https://github.com/rancher/terraform-provider-file/issues/29)) ([5e205de](https://github.com/rancher/terraform-provider-file/commit/5e205dec0c11fe197d6b23c260f34117587f317e))
* bump github.com/ulikunitz/xz from 0.5.10 to 0.5.14 in /test ([#126](https://github.com/rancher/terraform-provider-file/issues/126)) ([451a101](https://github.com/rancher/terraform-provider-file/commit/451a101355a87068280b1358e077b660a5d3cac7))
* correct sub issue address ([#47](https://github.com/rancher/terraform-provider-file/issues/47)) ([5c22091](https://github.com/rancher/terraform-provider-file/commit/5c220916e472616dbe55604c06b158428cdb0ede))
* correct the rc calculation ([#121](https://github.com/rancher/terraform-provider-file/issues/121)) ([e3164d8](https://github.com/rancher/terraform-provider-file/commit/e3164d8a78a228ef331e9dca8bc93e89c5a189ed))
* create a new array to save labels ([#36](https://github.com/rancher/terraform-provider-file/issues/36)) ([a9b314e](https://github.com/rancher/terraform-provider-file/commit/a9b314efd486e03d35dcf32a30f65d07ea1289dd))
* create issue when a pull request hits main ([#20](https://github.com/rancher/terraform-provider-file/issues/20)) ([241b72e](https://github.com/rancher/terraform-provider-file/commit/241b72e742810a3eecb26d0a8620c83e79686901))
* general workflow improvements ([#80](https://github.com/rancher/terraform-provider-file/issues/80)) ([b8de47c](https://github.com/rancher/terraform-provider-file/commit/b8de47c589a5ffba34cdb8da0e7841d76a5047a5))
* get version properly ([#109](https://github.com/rancher/terraform-provider-file/issues/109)) ([5fd4d8d](https://github.com/rancher/terraform-provider-file/commit/5fd4d8d555ea5a73219e6c91f91242979d5aef73))
* give issue write permissions ([#21](https://github.com/rancher/terraform-provider-file/issues/21)) ([6c10090](https://github.com/rancher/terraform-provider-file/commit/6c1009008dd1bf0539d2ac6d9340cc608de25054))
* hard code the owner and repo name ([#132](https://github.com/rancher/terraform-provider-file/issues/132)) ([a92bd56](https://github.com/rancher/terraform-provider-file/commit/a92bd56465062720741e8b49ea5f5eeb7c7bf78f))
* improve release please configuration ([#84](https://github.com/rancher/terraform-provider-file/issues/84)) ([368f3fb](https://github.com/rancher/terraform-provider-file/commit/368f3fbb449be6b932401ea5f2bec94b9911fd0a))
* manually generate release candidate tag ([#105](https://github.com/rancher/terraform-provider-file/issues/105)) ([5d83b0d](https://github.com/rancher/terraform-provider-file/commit/5d83b0d27a275566b56f4819d174c2a89b574c32))
* move release please to release branches ([#4](https://github.com/rancher/terraform-provider-file/issues/4)) ([31c5a03](https://github.com/rancher/terraform-provider-file/commit/31c5a03e8f476f3e73215ff4c732e72d185c68d4))
* only pull credentials after the release ([#68](https://github.com/rancher/terraform-provider-file/issues/68)) ([7afdc3d](https://github.com/rancher/terraform-provider-file/commit/7afdc3da8290ab07e3aa444dcd6f0645410b9476))
* remove backport info from pr template ([#35](https://github.com/rancher/terraform-provider-file/issues/35)) ([147a1e4](https://github.com/rancher/terraform-provider-file/commit/147a1e4509e08aefc75054cd90d88caf53e10cc9))
* remove console line ([#41](https://github.com/rancher/terraform-provider-file/issues/41)) ([d59cbcd](https://github.com/rancher/terraform-provider-file/commit/d59cbcd61aba8d43de8201e1dea6d0aa8c530e2a))
* remove console log and change count property ([#39](https://github.com/rancher/terraform-provider-file/issues/39)) ([e9ac9a9](https://github.com/rancher/terraform-provider-file/commit/e9ac9a95c3e5a1abe6507ce9f517906a0310cab1))
* remove try ([#31](https://github.com/rancher/terraform-provider-file/issues/31)) ([6e7bc56](https://github.com/rancher/terraform-provider-file/commit/6e7bc56d5366baab8a2376cc687730aa5ee88ae4))
* remove unnecessary data ([#45](https://github.com/rancher/terraform-provider-file/issues/45)) ([f12f1c0](https://github.com/rancher/terraform-provider-file/commit/f12f1c05f50d492692ba8d7d2f8c7e4b7149e864))
* resolve client and protection flaws ([#113](https://github.com/rancher/terraform-provider-file/issues/113)) ([a839769](https://github.com/rancher/terraform-provider-file/commit/a839769d2aafd6217388358d0e8c2f229d5e2b44))
* resolve merge conflicts in backport ([#50](https://github.com/rancher/terraform-provider-file/issues/50)) ([b79b58c](https://github.com/rancher/terraform-provider-file/commit/b79b58c5d4e4d8ca1c1fcba467a290cca0172df9))
* set specific permissions on release workflow ([#55](https://github.com/rancher/terraform-provider-file/issues/55)) ([90d32af](https://github.com/rancher/terraform-provider-file/commit/90d32af4353b7c8f18fa5ef53efa4c601b8557b3))
* tell release please not to skip the release ([#97](https://github.com/rancher/terraform-provider-file/issues/97)) ([3bb1331](https://github.com/rancher/terraform-provider-file/commit/3bb1331374fc2733745eb4e345f9778dff3fb552))
* try setting permissions at job level ([#59](https://github.com/rancher/terraform-provider-file/issues/59)) ([aa51770](https://github.com/rancher/terraform-provider-file/commit/aa517700c1772c027df28ed603b8f9612093a1ee))
* typo in backport pr script ([#117](https://github.com/rancher/terraform-provider-file/issues/117)) ([02c56ea](https://github.com/rancher/terraform-provider-file/commit/02c56ea5ef8aa8a71eaa27a5cb581f2a8529d77e))
* update actions GitHub script and setup go ([#168](https://github.com/rancher/terraform-provider-file/issues/168)) ([4e9fa0c](https://github.com/rancher/terraform-provider-file/commit/4e9fa0cca9e496452c264dacbab1a4dcc47802ee))
* update pull request template ([#22](https://github.com/rancher/terraform-provider-file/issues/22)) ([96b5e8c](https://github.com/rancher/terraform-provider-file/commit/96b5e8c36fafd31c67d29b99ec25662d42b02798))
* use a different context ([#16](https://github.com/rancher/terraform-provider-file/issues/16)) ([55f8f9a](https://github.com/rancher/terraform-provider-file/commit/55f8f9aee6a515d0baeb23c76fe3719c8a4c8587))
* use API directly to query issues ([#37](https://github.com/rancher/terraform-provider-file/issues/37)) ([d63321b](https://github.com/rancher/terraform-provider-file/commit/d63321b3e3b4b533403a3fe2da39e897359fce99))
* Use more advanced release configuration ([#75](https://github.com/rancher/terraform-provider-file/issues/75)) ([5078fda](https://github.com/rancher/terraform-provider-file/commit/5078fdae03a05071796a46b3466f6ee1c6409a6d))
* use new path to attach sub issue ([#9](https://github.com/rancher/terraform-provider-file/issues/9)) ([814c480](https://github.com/rancher/terraform-provider-file/commit/814c480d602f25cdf7f4e14e27a8344d8a245e0b))
* use new search API and handle empty label ([#34](https://github.com/rancher/terraform-provider-file/issues/34)) ([c4dad54](https://github.com/rancher/terraform-provider-file/commit/c4dad54b852a60ec115f2309eaa4bb1c78751912))
* use rest request to get sub issues ([#33](https://github.com/rancher/terraform-provider-file/issues/33)) ([3cb32e0](https://github.com/rancher/terraform-provider-file/commit/3cb32e0d3da37d212979db230de39911a47fa3d4))
* use the API endpoint to attach the sub issue ([#11](https://github.com/rancher/terraform-provider-file/issues/11)) ([7aeb11c](https://github.com/rancher/terraform-provider-file/commit/7aeb11cd143e63a15971df2b4bf1f1b32d979b77))
* use the full payload issue ([#15](https://github.com/rancher/terraform-provider-file/issues/15)) ([7a2ebd9](https://github.com/rancher/terraform-provider-file/commit/7a2ebd955e0166cc4ca3ec285aa904989cc43948))
* use the proper variable name ([#18](https://github.com/rancher/terraform-provider-file/issues/18)) ([3d6c9eb](https://github.com/rancher/terraform-provider-file/commit/3d6c9eb5bbfd3dcbd66023ac16d02b5edf8df556))


### Miscellaneous Chores

* release v1.0.0 ([b7eeb1b](https://github.com/rancher/terraform-provider-file/commit/b7eeb1b2d6620ab5d042c8a8c265b0e8bec1a16f))
* **release:** bumping version number ([#139](https://github.com/rancher/terraform-provider-file/issues/139)) ([6a43cc6](https://github.com/rancher/terraform-provider-file/commit/6a43cc60fce1a61af5fdff2066006b8357a852a0))
